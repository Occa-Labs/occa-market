/*
  Coming-soon roster — catalog cards for agents on the roadmap.

  Each entry is a full SeedAgentDef with `comingSoon: true`: the runner
  upserts the row WITHOUT a runtime binding (and clears one if present), so
  the card renders the existing "soon" state — badge, disabled button, not
  clickable. No gateway workspace, no on-chain registration; both happen
  when the agent graduates to defs.ts SEED_AGENTS with a real build.

  Detail here is a placeholder honest enough for a direct URL visit. The
  real detail (skills, tools, workflow, sample output) is authored when the
  agent is researched and built — one at a time, like Rug Radar was.
*/

import type { AgentCategory, AgentDetail } from "@occa-market/shared";
import type { SeedAgentDef } from "./defs";

type SoonSpec = {
  id: string;
  name: string;
  handle: string;
  glyph: string;
  tagline: string;
  category: AgentCategory;
  pricePerMsg: number;
  /** one extra sentence beyond the tagline, for the detail page */
  description: string;
};

function soon(spec: SoonSpec): SeedAgentDef {
  const detail: AgentDetail = {
    longDescription: `${spec.tagline} ${spec.description} In development — not yet taking requests.`,
    capabilities: [spec.tagline],
    skills: [],
    tools: [],
    workflow: [],
    examplePrompts: [],
    sampleOutput: {
      prompt: "",
      blocks: [
        {
          type: "summary",
          text: `${spec.name} is in development. ${spec.description}`,
        },
      ],
    },
    uptime: 0,
    categoryRank: 0,
    activity: [],
  };
  return {
    id: spec.id,
    name: spec.name,
    handle: spec.handle,
    glyph: spec.glyph,
    tagline: spec.tagline,
    category: spec.category,
    pricePerMsg: spec.pricePerMsg,
    detail,
    skills: [],
    toolNames: [],
    comingSoon: true,
  };
}

export const COMING_SOON_AGENTS: SeedAgentDef[] = [
  soon({
    id: "whale-watcher",
    name: "Whale Watcher",
    handle: "whale_watcher",
    glyph: "◈",
    tagline: "Follows the big wallets and explains what they're really doing.",
    category: "Research",
    pricePerMsg: 0.2,
    description:
      "Point it at a wallet or a transaction and it reconstructs the story — who moved what, where it went, and why it might matter.",
  }),
  soon({
    id: "tokenomics-grader",
    name: "Tokenomics Grader",
    handle: "tokenomics_grader",
    glyph: "▦",
    tagline: "Grades a token's supply, unlocks, and emissions before they dilute you.",
    category: "Research",
    pricePerMsg: 0.15,
    description:
      "Feed it docs or a project link and it scores the supply schedule, insider allocations, and the red flags buried in the fine print.",
  }),
  soon({
    id: "alpha-digest",
    name: "Alpha Digest",
    handle: "alpha_digest",
    glyph: "☰",
    tagline: "Compresses a day of crypto noise into one clean briefing.",
    category: "Research",
    pricePerMsg: 0.1,
    description:
      "Narratives, catalysts, and what actually moved — summarized with sources, minus the engagement bait.",
  }),
  soon({
    id: "chart-whisperer",
    name: "Chart Whisperer",
    handle: "chart_whisperer",
    glyph: "∿",
    tagline: "Reads the chart's structure — levels, trend, momentum — without the astrology.",
    category: "Trading",
    pricePerMsg: 0.15,
    description:
      "Pulls on-chain OHLCV for any pair and returns the levels, structure, and momentum read a disciplined trader would mark up.",
  }),
  soon({
    id: "funding-scout",
    name: "Funding Scout",
    handle: "funding_scout",
    glyph: "⇌",
    tagline: "Tracks funding rates and open interest to show where the crowd is leaning.",
    category: "Trading",
    pricePerMsg: 0.1,
    description:
      "Crowded longs, flipped funding, and open-interest divergences across major perp venues, in one read.",
  }),
  soon({
    id: "thread-smith",
    name: "Thread Smith",
    handle: "thread_smith",
    glyph: "✎",
    tagline: "Turns your notes and changelogs into threads people actually read.",
    category: "Content",
    pricePerMsg: 0.1,
    description:
      "Give it raw notes, a changelog, or a launch plan and it returns a structured crypto-native thread with a real hook.",
  }),
  soon({
    id: "meme-forge",
    name: "Meme Forge",
    handle: "meme_forge",
    glyph: "✦",
    tagline: "Names, tickers, and one-liners with real degen energy.",
    category: "Content",
    pricePerMsg: 0.05,
    description:
      "Naming, ticker candidates, taglines, and meme angles for a token or project — volume and variety on demand.",
  }),
  soon({
    id: "approval-auditor",
    name: "Approval Auditor",
    handle: "approval_auditor",
    glyph: "▣",
    tagline: "Finds the token approvals quietly holding your wallet hostage.",
    category: "Security",
    pricePerMsg: 0.1,
    description:
      "Scans a wallet's live approvals, ranks them by how much they can drain, and hands you the revoke order.",
  }),
  soon({
    id: "yield-scout",
    name: "Yield Scout",
    handle: "yield_scout",
    glyph: "❖",
    tagline: "Surfaces yield that's worth the risk — and says which risk.",
    category: "DeFi",
    pricePerMsg: 0.15,
    description:
      "Screens live pools and vaults, then frames each rate against the risk that pays it: contract, peg, IL, or ponzinomics.",
  }),
  soon({
    id: "tx-translator",
    name: "Tx Translator",
    handle: "tx_translator",
    glyph: "⇄",
    tagline: "Turns raw calldata into a sentence you can actually trust.",
    category: "Utility",
    pricePerMsg: 0.05,
    description:
      "Paste a transaction hash or the calldata a dapp wants you to sign, and it says in plain words what would happen.",
  }),
];
