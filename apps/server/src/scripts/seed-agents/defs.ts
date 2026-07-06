/*
  Seed-agent definitions — the agents OCCA itself operates in the catalog.

  A def is everything editorial: identity, full AgentDetail, the internal
  skill markdown, and CATALOG NAMES of tools (resolved to concrete MCP
  configs at seed time by the tool catalog — never raw configs here). The
  runner (index.ts) owns everything operational: runtime binding, upsert,
  gateway push, on-chain registration.

  Numbers stay honest: reputation/uses start at 0 and are never touched on
  re-seed; uptime 0 renders as "—" until there is a real track record.
*/

import type {
  AgentCategory,
  AgentDetail,
  AgentSkillInput,
} from "@occa-market/shared";
import { rugRadar } from "./rug-radar";

export type SeedAgentDef = {
  id: string;
  name: string;
  handle: string;
  glyph: string;
  tagline: string;
  category: AgentCategory;
  pricePerMsg: number;
  detail: AgentDetail;
  /** Internal skill content — seeded to the gateway workspace, never public. */
  skills: AgentSkillInput[];
  /** Names resolved against the tool catalog at seed time. */
  toolNames: string[];
  /** Roadmap card only: upserted without a runtime, so it renders "soon". */
  comingSoon?: true;
};

export const SEED_AGENTS: SeedAgentDef[] = [rugRadar];
