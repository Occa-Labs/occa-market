/*
  Typed API client — the ONE place the web talks to the server. Components and
  pages call these functions, never fetch() with a raw URL. All shapes come
  from @occa-market/shared, so client and server can't drift.
*/

import type {
  AgentCreatedResponse,
  AgentDetailResponse,
  AgentListResponse,
  AgentSkillInput,
  AgentSource,
  AgentSourceResponse,
  AuthResponse,
  AuthUser,
  ChatHistoryResponse,
  ChatMessage,
  ChatRunEvent,
  ChatSession,
  ChatSessionListResponse,
  CreateAgentRequest,
  GatewayHealthRequest,
  GatewayHealthResponse,
  HistoryResponse,
  MarketAgent,
  MarketStats,
  SendMessageRequest,
  SendMessageResponse,
  SharedSessionResponse,
  ShareSessionResponse,
  TokenStanding,
  TokenStandingResponse,
  UpdateAgentRequest,
  SkillImportResponse,
} from "@occa-market/shared";
import { config } from "./config";

const base = config.apiBaseUrl;

// ── Session token (our JWT, minted after Privy login) ──────────────────────
const TOKEN_KEY = "occa_market_jwt";

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  if (typeof window !== "undefined") window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken(): void {
  if (typeof window !== "undefined") window.localStorage.removeItem(TOKEN_KEY);
}

function authHeaders(): Record<string, string> {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// RSC fetches must not be cached — the catalog is live data, not build output.
async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${base}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export async function listAgents(): Promise<MarketAgent[]> {
  const data = await getJson<AgentListResponse>("/api/agents");
  return data.agents;
}

/** The caller's published agents, newest first. Null when signed out. */
export async function getMyAgents(): Promise<MarketAgent[] | null> {
  const res = await fetch(`${base}/api/agents/mine`, {
    headers: authHeaders(),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as AgentListResponse;
  return data.agents;
}

export async function getAgentDetail(
  id: string,
): Promise<AgentDetailResponse | null> {
  const res = await fetch(`${base}/api/agents/${id}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GET /api/agents/${id} failed: ${res.status}`);
  return res.json() as Promise<AgentDetailResponse>;
}

export async function getMarketStats(): Promise<MarketStats> {
  return getJson<MarketStats>("/api/stats");
}

/** Market-wide per-run history, newest first. `before` pages older runs. */
export async function getRunHistory(before?: string): Promise<HistoryResponse> {
  const query = before ? `?before=${encodeURIComponent(before)}` : "";
  return getJson<HistoryResponse>(`/api/history${query}`);
}

export async function createAgent(
  body: CreateAgentRequest,
): Promise<
  | { ok: true; agent: MarketAgent; seeded: boolean; seedReason?: string }
  | { ok: false; error: string }
> {
  const res = await fetch(`${base}/api/agents`, {
    method: "POST",
    headers: { "content-type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (res.status === 201) {
    const data = (await res.json()) as AgentCreatedResponse;
    return {
      ok: true,
      agent: data.agent,
      seeded: data.seeded,
      seedReason: data.seedReason,
    };
  }
  const data = await res.json().catch(() => ({ error: "publish failed" }));
  return { ok: false, error: data.error ?? "publish failed" };
}

/** The editable source of an agent, for the edit wizard. Null when signed out or unknown. */
export async function getAgentSource(id: string): Promise<AgentSource | null> {
  const res = await fetch(`${base}/api/agents/${id}/source`, {
    headers: authHeaders(),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as AgentSourceResponse;
  return data.source;
}

/** Revise a published agent; the server re-seeds its gateway workspace. */
export async function updateAgent(
  id: string,
  body: UpdateAgentRequest,
): Promise<
  | { ok: true; agent: MarketAgent; seeded: boolean; seedReason?: string }
  | { ok: false; error: string }
> {
  const res = await fetch(`${base}/api/agents/${id}`, {
    method: "PUT",
    headers: { "content-type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (res.ok) {
    const data = (await res.json()) as AgentCreatedResponse;
    return {
      ok: true,
      agent: data.agent,
      seeded: data.seeded,
      seedReason: data.seedReason,
    };
  }
  const data = await res.json().catch(() => ({ error: "update failed" }));
  return { ok: false, error: data.error ?? "update failed" };
}

/** Import a skill's SKILL.md from a public GitHub repo (owner/repo/slug or URL). */
export async function importSkill(
  source: string,
): Promise<{ ok: true; skill: AgentSkillInput } | { ok: false; error: string }> {
  const res = await fetch(`${base}/api/agents/skills/import`, {
    method: "POST",
    headers: { "content-type": "application/json", ...authHeaders() },
    body: JSON.stringify({ source }),
  });
  if (res.ok) {
    const data = (await res.json()) as SkillImportResponse;
    return { ok: true, skill: data.skill };
  }
  const data = await res.json().catch(() => ({ error: "import failed" }));
  return { ok: false, error: data.error ?? "import failed" };
}

/** Probe a gateway's /v1/health through the server. Never throws. */
export async function testGateway(
  target: GatewayHealthRequest,
): Promise<GatewayHealthResponse> {
  try {
    const res = await fetch(`${base}/api/agents/gateway/health`, {
      method: "POST",
      headers: { "content-type": "application/json", ...authHeaders() },
      body: JSON.stringify(target),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: "probe failed" }));
      return { ok: false, error: "probe_rejected", reason: data.error ?? "probe failed" };
    }
    return (await res.json()) as GatewayHealthResponse;
  } catch {
    return { ok: false, error: "api_unreachable", reason: "can't reach the market API" };
  }
}

// ── Auth ───────────────────────────────────────────────────────────────────

/** Exchange a Privy access token for our session (JWT + user). */
export async function privyLogin(accessToken: string): Promise<AuthResponse> {
  const res = await fetch(`${base}/api/auth/privy`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ accessToken }),
  });
  if (!res.ok) throw new Error(`login failed: ${res.status}`);
  return res.json() as Promise<AuthResponse>;
}

/** Current user from the stored session token, or null if unauthenticated. */
export async function fetchMe(): Promise<AuthUser | null> {
  const res = await fetch(`${base}/api/auth/me`, {
    headers: authHeaders(),
    cache: "no-store",
  });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`me failed: ${res.status}`);
  const data = (await res.json()) as { user: AuthUser };
  return data.user;
}

// ── Holder standing ($OCCA tier + weekly budget) ───────────────────────────

/** The caller's holder standing. Null when signed out. */
export async function getTokenStanding(): Promise<TokenStanding | null> {
  const res = await fetch(`${base}/api/token/standing`, {
    headers: authHeaders(),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as TokenStandingResponse;
  return data.standing;
}

/** Force a chain re-read of the caller's balance — the "I just bought" button. */
export async function refreshTokenStanding(): Promise<TokenStanding | null> {
  const res = await fetch(`${base}/api/token/standing/refresh`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as TokenStandingResponse;
  return data.standing;
}

/**
 * Send a chat message. The server streams NDJSON — `{t:"event"}` lines feed
 * `onEvent` (the live activity timeline) as the agent works; the final
 * `{t:"result"}` line is returned. Pre-run failures (4xx) arrive as plain
 * JSON and are returned as a failed result.
 */
export async function sendMessage(
  id: string,
  body: SendMessageRequest,
  onEvent?: (event: ChatRunEvent) => void,
): Promise<SendMessageResponse> {
  const res = await fetch(`${base}/api/agents/${id}/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });

  if (res.headers.get("content-type")?.includes("application/json")) {
    return res.json() as Promise<SendMessageResponse>;
  }
  if (!res.body) return { ok: false, error: "stream_failed", reason: "empty response body" };

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let result: SendMessageResponse | null = null;

  const routeLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      const parsed = JSON.parse(trimmed) as {
        t?: string;
        event?: ChatRunEvent;
        result?: SendMessageResponse;
      };
      if (parsed.t === "event" && parsed.event) onEvent?.(parsed.event);
      else if (parsed.t === "result" && parsed.result) result = parsed.result;
    } catch {
      /* malformed line — skip */
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n")) >= 0) {
      routeLine(buf.slice(0, idx));
      buf = buf.slice(idx + 1);
    }
  }
  if (buf.trim()) routeLine(buf);

  return (
    result ?? {
      ok: false,
      error: "stream_failed",
      reason: "the reply stream ended without a result",
    }
  );
}

/** The caller's sessions with an agent, most recently active first. Null when signed out. */
export async function listChatSessions(id: string): Promise<ChatSession[] | null> {
  const res = await fetch(`${base}/api/agents/${id}/sessions`, {
    headers: authHeaders(),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as ChatSessionListResponse;
  return data.sessions;
}

/** One session's stored messages. Null when signed out or not the caller's. */
export async function getSessionMessages(
  id: string,
  sessionId: string,
): Promise<ChatMessage[] | null> {
  const res = await fetch(`${base}/api/agents/${id}/sessions/${sessionId}/messages`, {
    headers: authHeaders(),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as ChatHistoryResponse;
  return data.messages;
}

/** Drop a session and its messages. */
export async function deleteChatSession(
  id: string,
  sessionId: string,
): Promise<boolean> {
  const res = await fetch(`${base}/api/agents/${id}/sessions/${sessionId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  return res.ok;
}

/** Thumbs an agent reply (+1 / −1, 0 clears). Feeds the agent's reputation. */
export async function rateMessage(
  id: string,
  sessionId: string,
  messageId: string,
  value: 1 | -1 | 0,
): Promise<boolean> {
  const res = await fetch(
    `${base}/api/agents/${id}/sessions/${sessionId}/messages/${messageId}/rating`,
    {
      method: "PUT",
      headers: { "content-type": "application/json", ...authHeaders() },
      body: JSON.stringify({ value }),
    },
  );
  return res.ok;
}

/** Make a session public; returns its share handle (idempotent). */
export async function shareChatSession(
  id: string,
  sessionId: string,
): Promise<string | null> {
  const res = await fetch(`${base}/api/agents/${id}/sessions/${sessionId}/share`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as ShareSessionResponse;
  return data.shareId;
}

/** Make a shared session private again. */
export async function unshareChatSession(
  id: string,
  sessionId: string,
): Promise<boolean> {
  const res = await fetch(`${base}/api/agents/${id}/sessions/${sessionId}/share`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  return res.ok;
}

/** A publicly shared session — no auth. Null when the link is dead. */
export async function getSharedSession(
  shareId: string,
): Promise<SharedSessionResponse | null> {
  const res = await fetch(`${base}/api/shares/${shareId}`, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json() as Promise<SharedSessionResponse>;
}
