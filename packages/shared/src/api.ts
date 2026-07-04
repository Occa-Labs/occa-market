/*
  HTTP wire contracts — the request/response shapes the server speaks and the
  web client consumes. Plain types only; request *validation* (zod) lives in
  the server's feature domain, mirroring OCCA's split (shared = wire types,
  feature/domain = zod schemas).
*/

import type {
  AgentCategory,
  AgentDetail,
  AgentRuntimeInput,
  AgentSkillInput,
  AgentToolInput,
  AgentWorkflowStep,
  MarketAgent,
} from "./agent";
import type { AuthUser } from "./auth";
import type { OutputBlock } from "./output";

/** One prior turn of chat, oldest first, for model context. */
export type ChatTurn = { role: "user" | "agent"; text: string };

/**
 * POST /api/agents/:id/messages body. Omitting sessionId starts a fresh
 * session — the server creates one (titled from the message) and returns its
 * id in the response.
 */
export type SendMessageRequest = {
  message: string;
  sessionId?: string;
};

/**
 * One conversation with an agent. A user can hold many sessions per agent —
 * the session, not the (user, agent) pair, is the thread. The auth token is
 * the identity; the client never sends a session *key*, only the session id.
 */
export type ChatSession = {
  id: string;
  title: string;
  createdAt: string;
  lastMessageAt: string;
};

/** GET /api/agents/:id/sessions response, most recently active first. */
export type ChatSessionListResponse = { sessions: ChatSession[] };

/**
 * One persisted chat message. User messages carry `text`; agent replies carry
 * `blocks`.
 */
export type ChatMessage = {
  id: string;
  role: "user" | "agent";
  text?: string;
  blocks?: OutputBlock[];
  createdAt: string;
};

/** GET /api/agents/:id/sessions/:sessionId/messages response. */
export type ChatHistoryResponse = { messages: ChatMessage[] };

export type MessageUsage = { costUsd: number };

/** The runtime's return shape (message in, reply blocks out). */
export type RuntimeResult =
  | { ok: true; blocks: OutputBlock[]; usage: MessageUsage }
  | { ok: false; error: string };

/**
 * POST /api/agents/:id/messages response — the runtime result plus the session
 * the exchange landed in (fresh when the request carried no sessionId).
 */
export type SendMessageResponse =
  | { ok: true; blocks: OutputBlock[]; usage: MessageUsage; session: ChatSession }
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
  runtime: AgentRuntimeInput;
};

/** POST /api/agents response. */
export type AgentCreatedResponse = {
  agent: MarketAgent;
  /** Whether the workspace (CLAUDE.md + .mcp.json) landed on the gateway. */
  seeded: boolean;
  seedReason?: string;
};

/**
 * POST /api/agents/skills/import — pull a skill's SKILL.md from a public GitHub
 * repo. `source` is an "owner/repo/slug" shorthand or a github.com tree URL.
 */
export type SkillImportRequest = { source: string };
export type SkillImportResponse = { skill: AgentSkillInput };

/**
 * POST /api/agents/gateway/health — probe a provider's gateway through the
 * server (the browser can't call it cross-origin). Returns the gateway's own
 * verdict: reachable + bearer valid + runtime ready.
 */
export type GatewayHealthRequest = { gatewayUrl: string; apiKey?: string };
export type GatewayHealthResponse = { ok: boolean; error?: string; reason?: string };

/** POST /api/auth/privy body — exchange a Privy access token for our session. */
export type PrivyLoginRequest = { accessToken: string };

/** POST /api/auth/privy and GET /api/auth/me response. */
export type AuthResponse = { token: string; user: AuthUser };
