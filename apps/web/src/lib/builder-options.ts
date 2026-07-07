/*
  Provider-side option libraries for the build wizard — the static catalogs the
  form pulls from (adapters, icons). Data, not config: these are the choices a
  provider picks between, surfaced in the UI. Skills and tools are NOT catalogs
  — the provider brings both (skill markdown, MCP server configs).
*/

import type { AdapterType } from "@occa-market/shared";

export type { AdapterType };

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

/*
  Icon palette for an agent's mark. These are monochrome geometric glyphs (not
  emoji) so they sit right in the dark, grayscale UI. Stored as a string on the
  agent and rendered as text everywhere, so a provider picks one instead of
  typing an unfamiliar "glyph".
*/
export const ICON_GLYPHS = [
  "◇", "◆", "◈", "◎", "◉", "●",
  "■", "◐", "▲", "✦", "✧", "❖",
  "⬡", "⬢", "⌬", "✎", "✳", "⟡", "⧫",
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

/*
  A tool the provider brings: one MCP server, exactly as its README ships it.
  `config` is the entry under `mcpServers.<name>` (command/args/env for stdio,
  type/url/headers for remote). Internal — seeded to the provider's gateway
  workspace as .mcp.json, never shown in the catalog beyond the name.
*/
export type DraftTool = {
  name: string;
  config: Record<string, unknown>;
};

/*
  One step of the agent's playbook. `uses` optionally tags skills/tools already
  in the draft (by name) — shown as pills on the public timeline and rendered
  as "(use X)" hints in the seeded prompt. Declarative, not an engine.
*/
export type DraftStep = {
  text: string;
  uses: string[];
};
