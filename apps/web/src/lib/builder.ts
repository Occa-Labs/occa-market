/*
  Build-your-agent draft model. The wizard state shape plus pure helpers that
  build, prefill, and preview a draft. UI-first: a draft lives in client state
  and "publish" is mocked.

  Domain rules baked in (blueprint §2.1): a provider hosts their own gateway,
  which can run several of their agents — each in an isolated workspace keyed by
  externalAgentId. No cross-provider pooling: an agent runs only on its provider's
  gateway and goes offline with it. The runtime (gateway + adapter) and the agent
  workspace (persona, skills, tools, workflow) are configured in the same flow.

  Option libraries (adapters, tools, skills) live in ./builder-options.
*/

import type { AgentCategory, AgentDetail, MarketAgent } from "@occa-market/shared";
import { ADAPTERS, type AdapterType, type DraftSkill } from "./builder-options";

export type ConnectionStatus = "idle" | "testing" | "ok" | "fail";

export type DraftAgent = {
  template: string | null;
  // identity (the product face)
  name: string;
  handle: string;
  glyph: string;
  category: AgentCategory;
  tagline: string;
  persona: string;
  pricePerMsg: number;
  // runtime (gateway + adapter, bound 1:1 to this agent)
  adapterType: AdapterType;
  gatewayUrl: string;
  apiKey: string;
  model: string;
  externalAgentId: string;
  connection: ConnectionStatus;
  // workspace
  skills: DraftSkill[];
  tools: string[];
  workflow: string[];
};

export function emptyDraft(): DraftAgent {
  return {
    template: null,
    name: "",
    handle: "",
    glyph: "◇",
    category: "Research",
    tagline: "",
    persona: "",
    pricePerMsg: 0.02,
    adapterType: "claude-code",
    gatewayUrl: "",
    apiKey: "",
    model: ADAPTERS[0].defaultModel,
    externalAgentId: "",
    connection: "idle",
    skills: [],
    tools: [],
    workflow: [],
  };
}

/** Fork a seed agent — prefills the workspace, leaves the gateway blank. */
export function draftFromTemplate(
  agent: MarketAgent,
  detail: AgentDetail,
): DraftAgent {
  return {
    ...emptyDraft(),
    template: agent.id,
    name: `${agent.name} fork`,
    handle: `${agent.handle}_fork`,
    glyph: agent.glyph,
    category: agent.category,
    tagline: agent.tagline,
    persona: detail.longDescription,
    pricePerMsg: agent.pricePerMsg,
    skills: detail.skills.map((s) => ({
      name: s.name,
      description: s.description,
      markdown: "",
      source: "markdown" as const,
    })),
    tools: detail.tools,
    workflow: detail.workflow,
  };
}

export function handleFromName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

/*
  Stable, unique id for the agent on the provider's own gateway (namespaces the
  workspace on their host). Readable slug from the handle/name, plus a random
  suffix so two agents — even with the same name — can never collide. The server
  should still be the final authority on uniqueness when publish is wired.
*/
export function makeExternalId(seed: string): string {
  const slug =
    seed
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32) || "agent";
  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 10);
  return `${slug}-${suffix}`;
}

/*
  Pull `name` / `description` out of a SKILL.md YAML frontmatter block, so a
  provider pasting a skill file doesn't have to retype them. Returns empty
  strings when there's no frontmatter or the keys are absent.
*/
export function parseSkillMarkdown(md: string): {
  name: string;
  description: string;
} {
  const fm = md.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!fm) return { name: "", description: "" };
  const unquote = (v: string) => v.trim().replace(/^["']|["']$/g, "");
  const name = fm[1].match(/^name:\s*(.+)$/m);
  const description = fm[1].match(/^description:\s*(.+)$/m);
  return {
    name: name ? unquote(name[1]) : "",
    description: description ? unquote(description[1]) : "",
  };
}

/** Build a catalog-card preview from the in-progress draft. */
export function draftToPreview(draft: DraftAgent): MarketAgent {
  return {
    id: "draft",
    name: draft.name || "Untitled agent",
    handle: draft.handle || "untitled",
    glyph: draft.glyph || "◇",
    tagline: draft.tagline || "No tagline yet.",
    category: draft.category,
    status: draft.connection === "ok" ? "online" : "offline",
    pricePerMsg: draft.pricePerMsg,
    reputation: 0,
    uses: 0,
    provider: "You",
    seed: false,
    accent: "#2ee6d6",
    available: true,
  };
}
