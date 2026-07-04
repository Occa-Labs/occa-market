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

import type { AgentCategory, AgentSource, MarketAgent } from "@occa-market/shared";
import {
  ADAPTERS,
  type AdapterType,
  type DraftSkill,
  type DraftStep,
  type DraftTool,
} from "./builder-options";

export type ConnectionStatus = "idle" | "testing" | "ok" | "fail";

export type DraftAgent = {
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
  tools: DraftTool[];
  workflow: DraftStep[];
};

export function emptyDraft(): DraftAgent {
  return {
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

/*
  Prefill a draft from a published agent's source (the edit flow). The apiKey
  is never returned by the server — blank means "keep the stored secret" — and
  the connection probe starts over, since editing shouldn't assume the gateway
  is still up.
*/
export function draftFromSource(source: AgentSource): DraftAgent {
  return {
    ...emptyDraft(),
    name: source.name,
    handle: source.handle,
    glyph: source.glyph,
    category: source.category,
    tagline: source.tagline,
    persona: source.persona,
    pricePerMsg: source.pricePerMsg,
    adapterType: (source.runtime?.adapterType as AdapterType) ?? "claude-code",
    gatewayUrl: source.runtime?.gatewayUrl ?? "",
    model: source.runtime?.model ?? ADAPTERS[0].defaultModel,
    externalAgentId: source.runtime?.externalAgentId ?? "",
    skills: source.skills.map((s) => ({
      name: s.name,
      description: s.description ?? "",
      markdown: s.markdown ?? "",
      source: s.source ?? "markdown",
      repoUrl: s.repoUrl,
      repoPath: s.repoPath,
    })),
    tools: source.tools.map((t) => ({ name: t.name, config: t.config ?? {} })),
    workflow: source.workflow.map((w) => ({ text: w.text, uses: w.uses ?? [] })),
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

/*
  Parse a pasted MCP server config into named tool entries. Liberal in what it
  accepts — the three shapes MCP READMEs ship:
    1. a full config:   {"mcpServers": {"name": {…}}}   (may hold several)
    2. a named entry:   {"name": {"command": …}}
    3. a bare entry:    {"command": …} or {"url": …}    (needs the name field)
*/
export type ParsedToolConfig =
  | { ok: true; tools: DraftTool[] }
  | { ok: false; error: string };

function isServerEntry(v: unknown): v is Record<string, unknown> {
  return (
    !!v &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    ("command" in v || "url" in v)
  );
}

export function parseToolConfig(
  raw: string,
  explicitName: string,
): ParsedToolConfig {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, error: "Not valid JSON." };
  }
  if (!json || typeof json !== "object" || Array.isArray(json)) {
    return { ok: false, error: "Expected a JSON object." };
  }
  const obj = json as Record<string, unknown>;

  // Unwrap a full {"mcpServers": {…}} document down to its server map.
  const wrapped = obj.mcpServers;
  const bag =
    wrapped && typeof wrapped === "object" && !Array.isArray(wrapped)
      ? (wrapped as Record<string, unknown>)
      : obj;

  // A bare entry — the pasted object IS the server config, so a name is needed.
  if (isServerEntry(bag)) {
    const name = explicitName.trim();
    if (!name) {
      return { ok: false, error: "Give the tool a name — the pasted config has none." };
    }
    return { ok: true, tools: [{ name, config: bag }] };
  }

  // A named map: one or more { name: entry } pairs.
  const entries = Object.entries(bag).filter(
    (e): e is [string, Record<string, unknown>] => isServerEntry(e[1]),
  );
  if (entries.length === 0) {
    return {
      ok: false,
      error: "No MCP server found — expected a `command` or `url` key.",
    };
  }
  const override = explicitName.trim();
  return {
    ok: true,
    tools: entries.map(([key, config]) => ({
      // An explicit name renames a single pasted entry; a multi-entry paste
      // keeps its own keys.
      name: entries.length === 1 && override ? override : key,
      config,
    })),
  };
}

/** One-line summary of an MCP server entry, for list rows. */
export function describeTool(config: Record<string, unknown>): string {
  if (typeof config.command === "string") {
    const args = Array.isArray(config.args) ? ` ${config.args.join(" ")}` : "";
    return `stdio · ${config.command}${args}`;
  }
  if (typeof config.url === "string") {
    const kind = typeof config.type === "string" ? config.type : "http";
    return `${kind} · ${config.url}`;
  }
  return "no config — display label only";
}

/** Guard for restored drafts — pre-rework drafts stored steps as strings. */
export function isDraftStep(v: unknown): v is DraftStep {
  if (!v || typeof v !== "object") return false;
  const s = v as { text?: unknown; uses?: unknown };
  return (
    typeof s.text === "string" &&
    Array.isArray(s.uses) &&
    s.uses.every((u) => typeof u === "string")
  );
}

/** Guard for restored drafts — pre-rework drafts stored tools as strings. */
export function isDraftTool(v: unknown): v is DraftTool {
  if (!v || typeof v !== "object") return false;
  const t = v as { name?: unknown; config?: unknown };
  return (
    typeof t.name === "string" &&
    !!t.config &&
    typeof t.config === "object" &&
    !Array.isArray(t.config)
  );
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
