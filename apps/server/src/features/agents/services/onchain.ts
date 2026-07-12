/*
  On-chain provenance service — registration + the daily anchor job.

  Registration mints an AgentIdentity + Deployment under the "OCCA Market"
  company for a catalog agent. The anchor job then walks every registered
  agent, finds complete UTC days with replies that lack an anchor, folds the
  day's (messageId, contentHash, rating) leaves into a Merkle root, and
  commits it via the registry's commit_daily_anchor. The reputation math
  itself stays off-chain — the chain locks the inputs.

  Both paths are best-effort by design: a chain hiccup must never block a
  publish or take the server down, so failures log and move on. The next run
  (hourly) retries anything unanchored.
*/

import type { AgentRow } from "../../../infra/database/schema";
import {
  commitDailyAnchorOnchain,
  dailyAnchorExists,
  onchainEnabled,
  registerAgentOnchain,
} from "../../../infra/onchain/client";
import { leafHash, merkleRoot, sha256 } from "../../../infra/onchain/merkle";
import {
  ensureAgentVault,
  settlementEnabled,
} from "../../../infra/onchain/settlement";
import { env } from "../../../config/env";
import {
  agentProviderWallet,
  listAgentsWithoutOnchain,
  nextDeploymentIndex,
  updateAgentRow,
} from "../repositories/agents";
import {
  insertDailyAnchor,
  listDayExchanges,
  listOnchainAgents,
  listUnanchoredDays,
} from "../repositories/anchors";

/**
 * Register one agent under the market company, persisting the PDAs on its
 * row. No-op when onchain is unconfigured or the agent is already registered.
 */
export async function ensureAgentOnchain(row: AgentRow): Promise<boolean> {
  if (!onchainEnabled() || row.onchain) return false;
  const index = await nextDeploymentIndex();
  const registration = await registerAgentOnchain(row.id, row.name, index);
  await updateAgentRow(row.id, { onchain: registration });
  console.log(
    `[onchain] registered ${row.id}: deployment #${index} ${registration.deploymentPda}`,
  );
  // Give the agent its settlement vault too (best-effort; the x402 rail can
  // fall back to the treasury wallet until the vault exists).
  await ensureVaultForAgent(row.id, registration.agentPubkey);
  return true;
}

/**
 * Create an agent's settlement vault, paying out to its owner's wallet (or the
 * treasury wallet when the agent has no linked owner). Best-effort: a failure
 * logs and returns false so it never blocks a publish. No-op when settlement
 * is unconfigured.
 */
export async function ensureVaultForAgent(
  agentId: string,
  agentPubkey: string,
): Promise<boolean> {
  if (!settlementEnabled()) return false;
  const providerWallet = (await agentProviderWallet(agentId)) ?? env.credits.depositWallet;
  if (!providerWallet) return false;
  try {
    return await ensureAgentVault(agentPubkey, agentId, providerWallet);
  } catch (err) {
    console.error(`[settlement] vault creation failed for ${agentId}:`, err);
    return false;
  }
}

/**
 * Create settlement vaults for every on-chain agent that lacks one (backfill
 * + self-heal). Serialized; safe to re-run. Returns the number created.
 */
export async function ensureAllVaults(): Promise<number> {
  if (!settlementEnabled()) return 0;
  let created = 0;
  for (const row of await listOnchainAgents()) {
    if (row.onchain && (await ensureVaultForAgent(row.id, row.onchain.agentPubkey))) {
      created++;
    }
  }
  return created;
}

/**
 * Register every agent that predates on-chain support (or whose publish-time
 * registration failed). Serialized — deployment indices must not race.
 */
export async function registerMissingAgents(): Promise<number> {
  if (!onchainEnabled()) return 0;
  let registered = 0;
  for (const row of await listAgentsWithoutOnchain()) {
    try {
      if (await ensureAgentOnchain(row)) registered++;
    } catch (err) {
      console.error(`[onchain] registration failed for ${row.id}:`, err);
    }
  }
  return registered;
}

/**
 * Anchor every complete, unanchored UTC day for every registered agent.
 * Returns the number of anchors committed. Safe to call repeatedly — the
 * DB mirror and the on-chain PDA both dedupe per (agent, day).
 */
export async function runDailyAnchors(): Promise<number> {
  if (!onchainEnabled()) return 0;
  let committed = 0;
  for (const agent of await listOnchainAgents()) {
    const days = await listUnanchoredDays(agent.id);
    for (const dayUnix of days) {
      try {
        const exchanges = await listDayExchanges(agent.id, dayUnix);
        if (exchanges.length === 0) continue;
        const leaves = exchanges.map((x) =>
          leafHash({
            messageId: x.messageId,
            contentHash: sha256(
              JSON.stringify({ text: x.text, blocks: x.blocks }),
            ).toString("hex"),
            rating: x.rating,
          }),
        );
        const root = merkleRoot(leaves);
        // The chain is the source of truth for what's committed. If this day's
        // anchor PDA already exists on-chain, a prior sweep committed it but
        // the local mirror never got the row — a crash between the commit and
        // the insert (they're not atomic), or a reset dev DB. Re-initing the
        // PDA fails with "already in use", so backfill the mirror and move on:
        // the sweep self-heals instead of erroring every hour. The recomputed
        // root can drift from the on-chain one if the day's messages changed
        // since; the chain stays authoritative, this row is just the UI/dedup
        // mirror (txSig unknown — the commit predates this backfill).
        if (await dailyAnchorExists(agent.onchain!.deploymentPda, dayUnix)) {
          await insertDailyAnchor({
            agentId: agent.id,
            dayUnix,
            merkleRoot: root.toString("hex"),
            taskCount: exchanges.length,
            txSig: "",
          });
          console.log(
            `[onchain] ${agent.id} day ${new Date(dayUnix * 1000).toISOString().slice(0, 10)} already anchored on-chain — mirror backfilled`,
          );
          continue;
        }
        const txSig = await commitDailyAnchorOnchain(
          agent.onchain!.deploymentPda,
          dayUnix,
          root,
          exchanges.length,
        );
        await insertDailyAnchor({
          agentId: agent.id,
          dayUnix,
          merkleRoot: root.toString("hex"),
          taskCount: exchanges.length,
          txSig,
        });
        committed++;
        console.log(
          `[onchain] anchored ${agent.id} day ${new Date(dayUnix * 1000).toISOString().slice(0, 10)}: ${exchanges.length} tasks, tx ${txSig}`,
        );
      } catch (err) {
        console.error(`[onchain] anchor failed for ${agent.id} @ ${dayUnix}:`, err);
      }
    }
  }
  return committed;
}

const ANCHOR_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Boot-time scheduler: one immediate pass (also backfills registrations for
 * rows that predate on-chain support), then an hourly sweep. The hourly
 * cadence commits each new day shortly after its UTC midnight closes.
 */
export function startAnchorScheduler(): void {
  if (!onchainEnabled()) {
    console.log("[onchain] not configured — anchoring disabled");
    return;
  }
  const sweep = async () => {
    try {
      await registerMissingAgents();
      const vaults = await ensureAllVaults();
      if (vaults > 0) console.log(`[settlement] created ${vaults} vault(s)`);
      const n = await runDailyAnchors();
      if (n > 0) console.log(`[onchain] sweep committed ${n} day anchor(s)`);
    } catch (err) {
      console.error("[onchain] sweep failed:", err);
    }
  };
  void sweep();
  setInterval(sweep, ANCHOR_INTERVAL_MS).unref();
  console.log("[onchain] anchor scheduler running (hourly)");
}
