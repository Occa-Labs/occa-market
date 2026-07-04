/*
  Publish flow — turns a validated create request into a stored agent, then
  pushes its workspace (CLAUDE.md + .mcp.json) onto the provider's gateway.

  A published agent lands OFFLINE (not in ALLOWED_AGENTS), so it shows in the
  catalog as "coming soon" until it's reviewed and wired to a live gateway.
  Fields the wizard doesn't collect (sample output, activity) get sensible
  defaults here.
*/

import type { AgentDetail, MarketAgent } from "@occa-market/shared";
import type { NewAgentRow } from "../../../infra/database/schema";
import { gatewaySeed } from "../../../infra/gateway/client";
import { agentExists, getAgentRow, insertAgent } from "../repositories/agents";
import type { CreateAgentBody, UpdateAgentBody } from "../domain/schemas";
import { ensureAgentOnchain } from "./onchain";
import { buildSeedFiles } from "./runtime/seed";

const DEFAULT_ACCENT = "#2ee6d6";

export type PublishResult =
  | { ok: true; agent: MarketAgent; seeded: boolean; seedReason?: string }
  | { ok: false; error: string };

function slugify(handle: string): string {
  return handle
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// The handle plays no part in the detail document, so revisions (which fix
// the handle) share this builder with first publishes.
export function buildDetail(input: UpdateAgentBody): AgentDetail {
  // The capability names a workflow step is allowed to reference.
  const declared = new Set([
    ...input.skills.map((s) => s.name),
    ...input.tools.map((t) => t.name),
  ]);
  return {
    longDescription:
      input.persona ||
      `${input.tagline} Send it a request and it returns clean, ready-to-use output.`,
    capabilities: [input.tagline, "Returns structured, ready-to-use output"],
    // Public labels only — a skill's markdown is internal (seeded to the
    // gateway, blueprint §12), persisted separately when seeding is wired.
    skills: input.skills.length
      ? input.skills.map((s) => ({ name: s.name, description: s.description }))
      : [{ name: "Structured output", description: "" }],
    // Same split for tools: the catalog shows names, the MCP config is
    // internal. No fabricated default — tools are provider-brought now.
    tools: input.tools.map((t) => t.name),
    // Playbook steps as authored — no fabricated default. A step may only
    // tag skills/tools the agent actually declares; unknown tags are dropped.
    workflow: input.workflow.map((s) => ({
      text: s.text,
      uses: s.uses.filter((u) => declared.has(u)),
    })),
    examplePrompts: ["What can you do?", "Run this for me", "Show me an example"],
    sampleOutput: {
      prompt: "show me an example",
      blocks: [
        { type: "verdict", label: "Done", level: "ok" },
        {
          type: "summary",
          text: `${input.name} took the request and returned clean, structured output in seconds.`,
        },
        {
          type: "signals",
          items: [
            { label: "Request understood", status: "ok" },
            { label: "Output delivered", status: "ok" },
          ],
        },
      ],
    },
    uptime: 0,
    categoryRank: 0,
    activity: [],
  };
}

export async function publishAgent(
  input: CreateAgentBody,
  ownerUserId: string,
): Promise<PublishResult> {
  const id = slugify(input.handle);
  if (!id) return { ok: false, error: "handle must contain letters or numbers" };
  if (await agentExists(id)) return { ok: false, error: "handle already taken" };

  const detail = buildDetail(input);
  const row: NewAgentRow = {
    id,
    name: input.name,
    handle: input.handle,
    glyph: input.glyph,
    tagline: input.tagline,
    category: input.category,
    status: "offline",
    pricePerMsg: input.pricePerMsg,
    reputation: 0,
    uses: 0,
    provider: "Community",
    seed: false,
    accent: DEFAULT_ACCENT,
    detail,
    // Internal skill content (markdown) — kept for gateway seeding, not public.
    skillSources: input.skills,
    // Internal MCP server configs — become the workspace .mcp.json at seed time.
    toolConfigs: input.tools,
    // Internal BYORT binding — where this agent runs.
    runtime: input.runtime,
    // The publisher — the one identity allowed to read source and revise.
    ownerUserId,
  };

  const agent = await insertAgent(row);

  // Mint the on-chain identity + deployment in the background — two devnet
  // txs must not sit in the publish latency, and the hourly sweep retries
  // any miss. Publish never fails on a chain hiccup.
  void getAgentRow(id)
    .then((stored) => (stored ? ensureAgentOnchain(stored) : false))
    .catch((err) => console.error(`[onchain] publish registration failed for ${id}:`, err));

  // Push the workspace onto the provider's gateway. Publish still succeeds if
  // the push fails — the catalog row is real, and the workspace can be pushed
  // again once the gateway is reachable (re-seed endpoint comes with wiring).
  const seeded = await gatewaySeed(
    { gatewayUrl: input.runtime.gatewayUrl, apiKey: input.runtime.apiKey },
    input.runtime.externalAgentId,
    buildSeedFiles(agent, detail, input.skills, input.tools),
  );

  return { ok: true, agent, seeded: seeded.ok, seedReason: seeded.reason };
}
