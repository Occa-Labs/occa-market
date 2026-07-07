/*
  Seed OCCA's own catalog agents — `pnpm db:seed` (root: `pnpm db:seed`).

  Idempotent upsert per definition in defs.ts: a new id is inserted, an
  existing one gets its editorial fields and runtime refreshed while
  reputation, uses, and on-chain footprint stay untouched. Every run pushes
  the workspace (CLAUDE.md + .mcp.json) to the seed gateway, so re-running
  after editing a def or the tool catalog is the whole update story.

  Needs SEED_GATEWAY_URL / SEED_GATEWAY_API_KEY (the gateway that runs our
  agents) — fails fast with a readable message when missing.
*/

import type { AgentRuntimeInput } from "@occa-market/shared";
import { env } from "../../config/env";
import { gatewaySeed } from "../../infra/gateway/client";
import {
  agentExists,
  getAgentRow,
  insertAgent,
  updateAgentRow,
} from "../../features/agents/repositories/agents";
import { ensureAgentOnchain } from "../../features/agents/services/onchain";
import { buildSeedFiles } from "../../features/agents/services/runtime/seed";
import { resolveCatalogTools } from "../../features/agents/services/runtime/tool-catalog";
import { SEED_AGENTS } from "./defs";

// Same default accent the publish flow stamps (create-agent.ts).
const ACCENT = "#2ee6d6";

async function main(): Promise<void> {
  const { url, apiKey } = env.seedGateway;
  if (!url) {
    console.error(
      "SEED_GATEWAY_URL is not set — point it at the gateway that runs OCCA's seed agents.",
    );
    process.exit(1);
  }

  let failures = 0;
  for (const def of SEED_AGENTS) {
    const tools = resolveCatalogTools(def.toolNames);
    // Coming-soon rows carry no runtime — that null is what renders the
    // catalog card as "soon" (and clears the binding if one existed).
    const runtime: AgentRuntimeInput | null = def.comingSoon
      ? null
      : {
          adapterType: "claude-code",
          gatewayUrl: url,
          apiKey: apiKey ?? undefined,
          model: env.runtimeModel,
          externalAgentId: `${def.id}-mkt01`,
        };
    const editorial = {
      name: def.name,
      handle: def.handle,
      glyph: def.glyph,
      tagline: def.tagline,
      category: def.category,
      pricePerMsg: def.pricePerMsg,
      detail: def.detail,
      skillSources: def.skills,
      toolConfigs: tools,
      runtime,
      provider: "OCCA",
      seed: true,
      accent: ACCENT,
    };

    const agent = (await agentExists(def.id))
      ? await updateAgentRow(def.id, editorial)
      : await insertAgent({ id: def.id, status: "offline", ...editorial });
    if (!agent) {
      console.error(`✗ ${def.id}: upsert failed`);
      failures++;
      continue;
    }

    if (!runtime) {
      console.log(`✓ ${def.id}: upserted as coming soon`);
      continue;
    }

    const seeded = await gatewaySeed(
      { gatewayUrl: url, apiKey: apiKey ?? undefined },
      runtime.externalAgentId,
      buildSeedFiles(agent, def.detail, def.skills, tools),
    );
    if (!seeded.ok) {
      console.error(`✗ ${def.id}: row upserted but gateway seed failed (${seeded.reason ?? seeded.error})`);
      failures++;
      continue;
    }

    // Devnet registration — best-effort like the publish path; a chain hiccup
    // must not fail the seed. No-op when onchain is unconfigured.
    try {
      const stored = await getAgentRow(def.id);
      if (stored) await ensureAgentOnchain(stored);
    } catch (err) {
      console.error(`[onchain] registration failed for ${def.id}:`, err);
    }

    console.log(`✓ ${def.id}: upserted + seeded ${seeded.pushed} workspace file(s)`);
  }

  process.exit(failures > 0 ? 1 : 0);
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
