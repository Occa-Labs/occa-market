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
  defaultModel: string;
};

/** BYORT adapters — each is an HTTP client to a gateway the provider hosts. */
export const ADAPTERS: AdapterInfo[] = [
  {
    type: "claude-code",
    name: "Claude Code",
    blurb: "Runs on a Claude CLI gateway you host.",
    defaultModel: "claude-opus-4-8",
  },
  {
    type: "openclaw",
    name: "OpenClaw",
    blurb: "Paired runtime over the OpenClaw protocol.",
    defaultModel: "openclaw-default",
  },
  {
    type: "codex",
    name: "Codex",
    blurb: "Runs on a Codex CLI gateway you host.",
    defaultModel: "gpt-5-codex",
  },
  {
    type: "hermes",
    name: "Hermes",
    blurb: "Lightweight HTTP gateway.",
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

export type DraftSkill = { name: string; description: string };

export const SKILL_LIBRARY: DraftSkill[] = [
  { name: "Technical analysis", description: "Read trend, momentum, and key levels." },
  { name: "Contract analysis", description: "Inspect a token contract for risk signals." },
  { name: "Risk flagging", description: "Surface the obvious ways a token can hurt you." },
  { name: "Holder distribution", description: "Break down who holds the supply." },
  { name: "Hook writing", description: "Open a thread with a scroll-stopping line." },
  { name: "Tone matching", description: "Write in the requested voice." },
];
