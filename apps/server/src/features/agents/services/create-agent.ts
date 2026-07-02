/*
  Publish flow — turns a validated create request into a stored agent.

  A published agent lands OFFLINE (not in ALLOWED_AGENTS), so it shows in the
  catalog as "coming soon" until it's reviewed and wired to a live gateway.
  Fields the wizard doesn't collect (sample output, activity) get sensible
  defaults here, the same way fallbackDetail fills them for un-authored agents.
*/

import type { AgentDetail, MarketAgent } from "@occa-market/shared";
import type { NewAgentRow } from "../../../infra/database/schema";
import { agentExists, insertAgent } from "../repositories/agents";
import type { CreateAgentBody } from "../domain/schemas";

const DEFAULT_ACCENT = "#2ee6d6";

type PublishResult =
  | { ok: true; agent: MarketAgent }
  | { ok: false; error: string };

function slugify(handle: string): string {
  return handle
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function buildDetail(input: CreateAgentBody): AgentDetail {
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
    tools: input.tools.length ? input.tools : ["Live data feed"],
    workflow: input.workflow.length
      ? input.workflow
      : ["Take your request", "Run its workspace skills", "Return ready-to-use output"],
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

export async function publishAgent(input: CreateAgentBody): Promise<PublishResult> {
  const id = slugify(input.handle);
  if (!id) return { ok: false, error: "handle must contain letters or numbers" };
  if (await agentExists(id)) return { ok: false, error: "handle already taken" };

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
    detail: buildDetail(input),
    // Internal skill content (markdown) — kept for gateway seeding, not public.
    skillSources: input.skills,
  };

  const agent = await insertAgent(row);
  return { ok: true, agent };
}
