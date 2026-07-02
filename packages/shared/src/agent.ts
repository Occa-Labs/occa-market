/*
  Agent domain types — the catalog card shape (MarketAgent) and the detail
  record (AgentDetail). Pure contracts shared by server and web.

  Public-framing note (blueprint §12): every field describes the agent's WORK /
  OUTPUT, never raw inference, never the provider's subscription. Status is
  just online / offline.
*/

import type { ActivityEvent, OutputBlock, SampleOutput } from "./output";

export type AgentCategory =
  | "Research"
  | "Trading"
  | "Content"
  | "Security"
  | "DeFi"
  | "Utility";

export const CATEGORIES: AgentCategory[] = [
  "Research",
  "Trading",
  "Content",
  "Security",
  "DeFi",
  "Utility",
];

export type AgentStatus = "online" | "offline";

export type MarketAgent = {
  id: string;
  name: string;
  handle: string;
  glyph: string;
  tagline: string;
  category: AgentCategory;
  status: AgentStatus;
  /** USDC per message — the credit-debit unit (metering still PROPOSED). */
  pricePerMsg: number;
  /** 0–100 reputation, fed by trace-anchor track record later. */
  reputation: number;
  /** lifetime usage count, drives the leaderboard story. */
  uses: number;
  /** provider display handle; seed agents are openly OCCA-operated. */
  provider: string;
  /** OCCA-operated seed agent, disclosed (blueprint §12 last row). */
  seed: boolean;
  accent: string;
  /** live in this build (vs "coming soon"); computed server-side from config. */
  available: boolean;
};

/** A skill's public descriptor — shown in the catalog, no internal instructions. */
export type AgentSkill = { name: string; description: string };

/** Where a provider-brought skill's content came from. */
export type SkillSource = "markdown" | "repo";

/**
 * A skill the provider brings, with its full instruction content. `markdown` is
 * INTERNAL — seeded into the agent's gateway workspace (blueprint §12) and never
 * shown in the public catalog, which sees only name + description. When `source`
 * is "repo", the content was imported from repoUrl/repoPath.
 */
export type AgentSkillInput = {
  name: string;
  description: string;
  markdown: string;
  source: SkillSource;
  repoUrl?: string;
  repoPath?: string;
};

export type AgentDetail = {
  longDescription: string;
  capabilities: string[];
  /** what the agent can do — its workspace skills, public labels only (§2.1/§12) */
  skills: AgentSkill[];
  /** integrations the agent calls to do its work, not raw inference (§12) */
  tools: string[];
  /** ordered steps the agent runs per request — the connector/timeline motif */
  workflow: string[];
  examplePrompts: string[];
  sampleOutput: SampleOutput;
  /** extra canned reply variants for the chat surface (beyond sampleOutput) */
  chatReplies?: OutputBlock[][];
  /** uptime percent, feeds reputation later */
  uptime: number;
  /** rank within the agent's category */
  categoryRank: number;
  activity: ActivityEvent[];
};
