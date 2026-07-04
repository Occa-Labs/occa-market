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
  /** Present when the session is publicly shared at /share/<shareId>. */
  shareId?: string;
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
  /** The caller's thumbs on an agent reply, when they rated it. */
  rating?: 1 | -1;
  createdAt: string;
};

/**
 * PUT /api/agents/:id/sessions/:sessionId/messages/:messageId/rating body.
 * +1 / −1 set the thumbs, 0 clears it. Ratings feed the agent's reputation
 * (runs + 5 × net thumbs) and stay auditable back to the conversation.
 */
export type RateMessageRequest = { value: 1 | -1 | 0 };

/** GET /api/agents/:id/sessions/:sessionId/messages response. */
export type ChatHistoryResponse = { messages: ChatMessage[] };

/** POST /api/agents/:id/sessions/:sessionId/share response. */
export type ShareSessionResponse = { shareId: string };

/**
 * GET /api/shares/:shareId response — a publicly shared session, read-only.
 * Carries the agent's public projection so the page can render identity and
 * point back at the catalog; never any runtime or provider internals.
 */
export type SharedSessionResponse = {
  agent: MarketAgent;
  title: string;
  createdAt: string;
  messages: ChatMessage[];
};

export type MessageUsage = { costUsd: number };

/**
 * The runtime's return shape (message in, reply blocks out). On failure,
 * `error` is a stable machine code (gateway_unreachable, timeout, …) the UI
 * maps to human copy, and `reason` is the raw technical detail (stderr
 * snippet, HTTP status) shown alongside it.
 */
export type RuntimeResult =
  | { ok: true; blocks: OutputBlock[]; usage: MessageUsage }
  | { ok: false; error: string; reason?: string };

/**
 * POST /api/agents/:id/messages response — the runtime result plus the session
 * the exchange landed in (fresh when the request carried no sessionId).
 *
 * The endpoint streams NDJSON: zero or more `{t:"event", event}` lines while
 * the agent works, then one final `{t:"result", result}` line of this shape.
 */
export type SendMessageResponse =
  | {
      ok: true;
      blocks: OutputBlock[];
      usage: MessageUsage;
      session: ChatSession;
      /** The stored agent reply's id — the handle for rating it. */
      messageId: string;
    }
  | { ok: false; error: string; reason?: string };

/**
 * One live activity event while a turn runs — the chat's "what is the agent
 * doing" timeline. A trimmed projection of the gateway's stream: tool names
 * only, never tool inputs/outputs (those are the provider's internals).
 */
export type ChatRunEvent = {
  kind: "assistant_text" | "tool_use" | "tool_result" | "error";
  toolName?: string;
  isError?: boolean;
};

/** GET /api/agents response. */
export type AgentListResponse = { agents: MarketAgent[] };

/**
 * The public projection of an agent's runtime binding — what powers it, never
 * where. The gateway URL, bearer, and externalAgentId stay server-side (the
 * provider's host is not a public address).
 */
export type PublicRuntime = { adapterType: string; model: string };

/** One committed daily provenance anchor — mirrors the on-chain account. */
export type OnchainAnchor = {
  /** UTC midnight of the anchored day, unix seconds. */
  dayUnix: number;
  /** Agent replies covered by this root. */
  taskCount: number;
  /** Merkle root over the day's (messageId, contentHash, rating) leaves, hex. */
  merkleRoot: string;
  txSig: string;
};

/**
 * One UTC day of run history. Runs land here (from the DB) the moment they
 * happen; `anchored` flips once the day closes and its Merkle root is
 * committed on-chain — until then the day reads as pending.
 */
export type OnchainDayStatus = {
  /** UTC midnight of the day, unix seconds. */
  dayUnix: number;
  taskCount: number;
  anchored: boolean;
  /** Commit transaction, present once anchored. */
  txSig?: string;
};

/**
 * The agent's on-chain footprint: AgentIdentity + Deployment PDAs under the
 * "OCCA Market" company on the OCCA registry program. Usage + ratings — the
 * reputation inputs — are committed as one Merkle root per UTC day, so the
 * score shown in the catalog is auditable against the chain.
 */
export type AgentOnchain = {
  identityPda: string;
  deploymentPda: string;
  /** Solana cluster the PDAs live on (explorer link target). */
  cluster: string;
  anchoredDays: number;
  lastAnchor?: OnchainAnchor;
  /** Recent run days, newest first — anchored and still-pending alike. */
  history: OnchainDayStatus[];
};

/**
 * One agent run in the market-wide history feed — metadata only (time,
 * agent, buyer thumbs, anchor status), never message content: chat bodies
 * belong to their session's owner.
 */
export type RunHistoryEntry = {
  /** The stored reply's message id. */
  id: string;
  createdAt: string;
  agent: { id: string; name: string; glyph: string };
  /** Buyer thumbs: 1, -1, or 0 when unrated. */
  rating: number;
  /** UTC midnight of the run's day, unix seconds. */
  dayUnix: number;
  /** True once the run's day root is committed on-chain. */
  anchored: boolean;
  /** The day's commit transaction, present once anchored. */
  txSig?: string;
};

export type HistoryStats = {
  totalRuns: number;
  anchoredDays: number;
  onchainAgents: number;
};

/**
 * GET /api/history response — newest first. `nextBefore` is the cursor for
 * the next (older) page; absent on the last page.
 */
export type HistoryResponse = {
  runs: RunHistoryEntry[];
  stats: HistoryStats;
  cluster: string;
  nextBefore?: string;
};

/** An agent paired with its detail record. */
export type AgentWithDetail = {
  agent: MarketAgent;
  detail: AgentDetail;
  /** Present when the agent runs on a provider's gateway (BYORT). */
  runtime?: PublicRuntime;
  /** Present when the agent is registered on-chain. */
  onchain?: AgentOnchain;
};

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
 * PUT /api/agents/:id body — everything a provider can revise. The handle (and
 * so the id) is fixed at publish. Omitting runtime.apiKey keeps the stored
 * secret; sending one replaces it.
 */
export type UpdateAgentRequest = Omit<CreateAgentRequest, "handle">;

/**
 * GET /api/agents/:id/source response — the full editable source of an agent,
 * internal skill markdown and tool configs included. Owner-facing only, never
 * a public projection. The runtime's apiKey is never returned.
 */
export type AgentSource = {
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
  runtime: Omit<AgentRuntimeInput, "apiKey"> | null;
};

export type AgentSourceResponse = { source: AgentSource };

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
