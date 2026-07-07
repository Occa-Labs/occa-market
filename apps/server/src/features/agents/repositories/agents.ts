/*
  Agent data access — the ONLY place the catalog is read or written. Routes,
  services, and the runtime go through these helpers, so the storage engine
  (now Drizzle/Postgres) stays out of the rest of the feature.
*/

import { and, count, desc, eq, gt, isNotNull, isNull } from "drizzle-orm";
import type {
  AgentDetail,
  AgentOnchain,
  AgentWithDetail,
  AgentWorkflowStep,
  MarketAgent,
} from "@occa-market/shared";
import { db } from "../../../infra/database/client";
import { decryptSecret, encryptSecret } from "../../../infra/crypto/secrets";
import {
  agents,
  type AgentRow,
  type NewAgentRow,
} from "../../../infra/database/schema";
import { onchainCluster } from "../../../infra/onchain/client";
import { toMarketAgent } from "../domain/dtos";
import { countAnchors, getLatestAnchor, listDayHistory } from "./anchors";

/*
  Rows written before the workflow rework store steps as plain strings; the
  wire type is now { text, uses }. Normalize at the read boundary so the rest
  of the app only ever sees the new shape — no data migration needed for a
  display-format change.
*/
/*
  Secret-bearing columns (skill_sources, tool_configs, runtime) are encrypted at
  rest via infra/crypto. Seal on the way into the DB, open on the way out —
  every caller above the repo sees plaintext, and the database only ever holds
  ciphertext (or legacy plaintext, which passes through until the backfill
  seals it).
*/
function sealSecrets<T extends Partial<NewAgentRow>>(row: T): T {
  const sealed = { ...row };
  if (sealed.skillSources !== undefined) {
    sealed.skillSources = encryptSecret(sealed.skillSources) as T["skillSources"];
  }
  if (sealed.toolConfigs !== undefined) {
    sealed.toolConfigs = encryptSecret(sealed.toolConfigs) as T["toolConfigs"];
  }
  if (sealed.runtime !== undefined) {
    sealed.runtime = encryptSecret(sealed.runtime) as T["runtime"];
  }
  return sealed;
}

function openSecrets(row: AgentRow): AgentRow {
  return {
    ...row,
    skillSources: decryptSecret(row.skillSources),
    toolConfigs: decryptSecret(row.toolConfigs),
    runtime: decryptSecret(row.runtime),
  };
}

function normalizeDetail(detail: AgentDetail): AgentDetail {
  // jsonb rows predating the rework hold strings, whatever the type says.
  const raw = (detail.workflow ?? []) as (AgentWorkflowStep | string)[];
  return {
    ...detail,
    workflow: raw.map((s) => (typeof s === "string" ? { text: s, uses: [] } : s)),
  };
}

// Live agents first (coming-soon cards sink), then seed agents, then newest.
// Availability is config-derived (runtime binding / ALLOWED_AGENTS), so that
// leg of the ordering happens on the projection, not in SQL; the sort is
// stable, so the seed/createdAt order holds within each group.
export async function listAgents(): Promise<MarketAgent[]> {
  const rows = await db
    .select()
    .from(agents)
    .orderBy(desc(agents.seed), desc(agents.createdAt));
  return rows
    .map(toMarketAgent)
    .sort((a, b) => Number(b.available) - Number(a.available));
}

export async function getAgent(id: string): Promise<MarketAgent | null> {
  const [row] = await db.select().from(agents).where(eq(agents.id, id)).limit(1);
  return row ? toMarketAgent(row) : null;
}

export async function getAgentDetail(id: string): Promise<AgentDetail | null> {
  const [row] = await db.select().from(agents).where(eq(agents.id, id)).limit(1);
  return row ? normalizeDetail(row.detail) : null;
}

export async function getAgentWithDetail(
  id: string,
): Promise<AgentWithDetail | null> {
  const [raw] = await db.select().from(agents).where(eq(agents.id, id)).limit(1);
  if (!raw) return null;
  // Open the runtime binding so the projection can read adapterType/model.
  const row = openSecrets(raw);
  // Rank is standing, not storage: position within the category by earned
  // reputation, computed at read so it can never go stale.
  const [{ ahead }] = await db
    .select({ ahead: count() })
    .from(agents)
    .where(
      and(eq(agents.category, row.category), gt(agents.reputation, row.reputation)),
    );
  // On-chain footprint: PDAs from the row, anchor history from the local
  // mirror (no RPC on the read path — the chain stays the audit trail).
  let onchain: AgentOnchain | undefined;
  if (row.onchain) {
    const [last, anchoredDays, history] = await Promise.all([
      getLatestAnchor(row.id),
      countAnchors(row.id),
      listDayHistory(row.id),
    ]);
    onchain = {
      identityPda: row.onchain.identityPda,
      deploymentPda: row.onchain.deploymentPda,
      cluster: onchainCluster(),
      anchoredDays,
      lastAnchor: last
        ? {
            dayUnix: Number(last.dayUnix),
            taskCount: last.taskCount,
            merkleRoot: last.merkleRoot,
            txSig: last.txSig,
          }
        : undefined,
      history,
    };
  }
  return {
    agent: toMarketAgent(row),
    detail: { ...normalizeDetail(row.detail), categoryRank: ahead + 1 },
    // Public runtime facts only — what powers the agent, never where it
    // lives. URL/bearer/externalAgentId stay internal.
    runtime: row.runtime
      ? { adapterType: row.runtime.adapterType, model: row.runtime.model }
      : undefined,
    onchain,
  };
}

/**
 * The raw row, internal fields included (runtime binding, tool configs).
 * For the runtime layer only — never project this to the wire.
 */
export async function getAgentRow(id: string): Promise<AgentRow | null> {
  const [row] = await db.select().from(agents).where(eq(agents.id, id)).limit(1);
  return row ? openSecrets(row) : null;
}

export async function agentExists(id: string): Promise<boolean> {
  const [row] = await db
    .select({ id: agents.id })
    .from(agents)
    .where(eq(agents.id, id))
    .limit(1);
  return Boolean(row);
}

export async function insertAgent(row: NewAgentRow): Promise<MarketAgent> {
  const [created] = await db.insert(agents).values(sealSecrets(row)).returning();
  return toMarketAgent(created);
}

/** The agents a user has published, newest first. */
export async function listAgentsByOwner(userId: string): Promise<MarketAgent[]> {
  const rows = await db
    .select()
    .from(agents)
    .where(eq(agents.ownerUserId, userId))
    .orderBy(desc(agents.createdAt));
  return rows.map(toMarketAgent);
}

/** Rows not yet registered on-chain — the registration backfill's worklist. */
export async function listAgentsWithoutOnchain(): Promise<AgentRow[]> {
  return db.select().from(agents).where(isNull(agents.onchain));
}

/**
 * Next free deployment index under the market company. Registrations are
 * serialized (boot backfill + publish path); a race would fail loudly at the
 * PDA init, never overwrite.
 */
export async function nextDeploymentIndex(): Promise<number> {
  const rows = await db
    .select({ onchain: agents.onchain })
    .from(agents)
    .where(isNotNull(agents.onchain));
  const max = rows.reduce(
    (acc, r) => Math.max(acc, r.onchain?.deploymentIndex ?? -1),
    -1,
  );
  return max + 1;
}

/** Apply a revision to an existing agent; null when the id is unknown. */
export async function updateAgentRow(
  id: string,
  patch: Partial<NewAgentRow>,
): Promise<MarketAgent | null> {
  const [updated] = await db
    .update(agents)
    .set(sealSecrets(patch))
    .where(eq(agents.id, id))
    .returning();
  return updated ? toMarketAgent(updated) : null;
}
