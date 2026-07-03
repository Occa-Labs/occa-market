/*
  HTTP wire contracts — the request/response shapes the server speaks and the
  web client consumes. Plain types only; request *validation* (zod) lives in
  the server's feature domain, mirroring OCCA's split (shared = wire types,
  feature/domain = zod schemas).
*/

import type {
  AgentCategory,
  AgentDetail,
  AgentSkillInput,
  AgentToolInput,
  AgentWorkflowStep,
  MarketAgent,
} from "./agent";
import type { AuthUser } from "./auth";
import type { OutputBlock } from "./output";

/** One prior turn of chat, oldest first, for model context. */
export type ChatTurn = { role: "user" | "agent"; text: string };

/** POST /api/agents/:id/messages body. */
export type SendMessageRequest = {
  message: string;
  sessionKey?: string;
  turn?: number;
  history?: ChatTurn[];
};

export type MessageUsage = { costUsd: number };

/** POST /api/agents/:id/messages response (and the runtime's return shape). */
export type RuntimeResult =
  | { ok: true; blocks: OutputBlock[]; usage: MessageUsage }
  | { ok: false; error: string };

/** GET /api/agents response. */
export type AgentListResponse = { agents: MarketAgent[] };

/** An agent paired with its detail record. */
export type AgentWithDetail = { agent: MarketAgent; detail: AgentDetail };

/** GET /api/agents/:id response. */
export type AgentDetailResponse = AgentWithDetail;

/** POST /api/agents body — the public-facing fields a provider publishes. */
export type CreateAgentRequest = {
  name: string;
  handle: string;
  glyph: string;
  category: AgentCategory;
  tagline: string;
  persona: string;
  pricePerMsg: number;
  skills: AgentSkillInput[];
  tools: AgentToolInput[];
  workflow: AgentWorkflowStep[];
};

/** POST /api/agents response. */
export type AgentCreatedResponse = { agent: MarketAgent };

/**
 * POST /api/agents/skills/import — pull a skill's SKILL.md from a public GitHub
 * repo. `source` is an "owner/repo/slug" shorthand or a github.com tree URL.
 */
export type SkillImportRequest = { source: string };
export type SkillImportResponse = { skill: AgentSkillInput };

/** POST /api/auth/privy body — exchange a Privy access token for our session. */
export type PrivyLoginRequest = { accessToken: string };

/** POST /api/auth/privy and GET /api/auth/me response. */
export type AuthResponse = { token: string; user: AuthUser };
