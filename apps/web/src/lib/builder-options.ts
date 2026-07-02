/*
  Provider-side option libraries for the build wizard — the static catalogs the
  form pulls from (adapters, tools, skills). Data, not config: these are the
  choices a provider picks between, surfaced in the UI.
*/

export type AdapterType = "claude-code" | "openclaw" | "codex" | "hermes";

export type AdapterInfo = {
  type: AdapterType;
  name: string;
  blurb: string;
  /** Selectable models for this adapter; the first is the default. */
  models: string[];
  defaultModel: string;
};

/** BYORT adapters — each is an HTTP client to a gateway the provider hosts. */
export const ADAPTERS: AdapterInfo[] = [
  {
    type: "claude-code",
    name: "Claude Code",
    blurb: "Runs on a Claude CLI gateway you host.",
    models: ["claude-opus-4-8", "claude-sonnet-5", "claude-haiku-4-5"],
    defaultModel: "claude-opus-4-8",
  },
  {
    type: "openclaw",
    name: "OpenClaw",
    blurb: "Paired runtime over the OpenClaw protocol.",
    models: ["openclaw-default"],
    defaultModel: "openclaw-default",
  },
  {
    type: "codex",
    name: "Codex",
    blurb: "Runs on a Codex CLI gateway you host.",
    models: ["gpt-5-codex", "gpt-5"],
    defaultModel: "gpt-5-codex",
  },
  {
    type: "hermes",
    name: "Hermes",
    blurb: "Lightweight HTTP gateway.",
    models: ["hermes-1"],
    defaultModel: "hermes-1",
  },
];

export const TOOL_LIBRARY = [
  "Price feed",
  "OHLCV history",
  "DEX pair feed",
  "On-chain RPC",
  "Block explorer",
  "Token sniffer",
  "Web search",
  "Trend feed",
  "Draft store",
  "Indicator engine",
];

/*
  Icon palette for an agent's mark. These are monochrome geometric glyphs (not
  emoji) so they sit right in the dark, grayscale UI. Stored as a string on the
  agent and rendered as text everywhere, so a provider picks one instead of
  typing an unfamiliar "glyph".
*/
export const ICON_GLYPHS = [
  "◇", "◆", "◈", "◎", "●", "■",
  "◐", "▲", "✦", "✧", "❖", "⬡",
  "⬢", "⌬", "✎", "✳", "⟡", "⧫",
];

/*
  A skill the provider brings. `markdown` is the instruction content (a SKILL.md
  body) — the real capability. `source` records how it was added: written/pasted
  inline, or imported from a repo (repoUrl/repoPath).
*/
export type SkillSource = "markdown" | "repo";

export type DraftSkill = {
  name: string;
  description: string;
  markdown: string;
  source: SkillSource;
  repoUrl?: string;
  repoPath?: string;
};
