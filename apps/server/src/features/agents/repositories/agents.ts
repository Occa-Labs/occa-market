/*
  Agent data access — the ONLY place the catalog is read or written. Routes,
  services, and the runtime go through these helpers, so the storage engine
  (now Drizzle/Postgres) stays out of the rest of the feature.
*/

import { desc, eq } from "drizzle-orm";
import type {
  AgentDetail,
  AgentWithDetail,
  AgentWorkflowStep,
  MarketAgent,
} from "@occa-market/shared";
import { db } from "../../../infra/database/client";
import {
  agents,
  type AgentRow,
  type NewAgentRow,
} from "../../../infra/database/schema";
import { toMarketAgent } from "../domain/dtos";

/*
  Rows written before the workflow rework store steps as plain strings; the
  wire type is now { text, uses }. Normalize at the read boundary so the rest
  of the app only ever sees the new shape — no data migration needed for a
  display-format change.
*/
function normalizeDetail(detail: AgentDetail): AgentDetail {
  // jsonb rows predating the rework hold strings, whatever the type says.
  const raw = (detail.workflow ?? []) as (AgentWorkflowStep | string)[];
  return {
    ...detail,
    workflow: raw.map((s) => (typeof s === "string" ? { text: s, uses: [] } : s)),
  };
}

// Seed agents first, then newest published agents.
export async function listAgents(): Promise<MarketAgent[]> {
  const rows = await db
    .select()
    .from(agents)
    .orderBy(desc(agents.seed), desc(agents.createdAt));
  return rows.map(toMarketAgent);
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
  const [row] = await db.select().from(agents).where(eq(agents.id, id)).limit(1);
  return row
    ? { agent: toMarketAgent(row), detail: normalizeDetail(row.detail) }
    : null;
}

/**
 * The raw row, internal fields included (runtime binding, tool configs).
 * For the runtime layer only — never project this to the wire.
 */
export async function getAgentRow(id: string): Promise<AgentRow | null> {
  const [row] = await db.select().from(agents).where(eq(agents.id, id)).limit(1);
  return row ?? null;
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
  const [created] = await db.insert(agents).values(row).returning();
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

/** Apply a revision to an existing agent; null when the id is unknown. */
export async function updateAgentRow(
  id: string,
  patch: Partial<NewAgentRow>,
): Promise<MarketAgent | null> {
  const [updated] = await db
    .update(agents)
    .set(patch)
    .where(eq(agents.id, id))
    .returning();
  return updated ? toMarketAgent(updated) : null;
}
