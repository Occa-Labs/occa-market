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
  AuthResponse,
  AuthUser,
  CreateAgentRequest,
  MarketAgent,
  MarketStats,
  RuntimeResult,
  SendMessageRequest,
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

export async function createAgent(
  body: CreateAgentRequest,
): Promise<{ ok: true; agent: MarketAgent } | { ok: false; error: string }> {
  const res = await fetch(`${base}/api/agents`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 201) {
    const data = (await res.json()) as AgentCreatedResponse;
    return { ok: true, agent: data.agent };
  }
  const data = await res.json().catch(() => ({ error: "publish failed" }));
  return { ok: false, error: data.error ?? "publish failed" };
}

/** Import a skill's SKILL.md from a public GitHub repo (owner/repo/slug or URL). */
export async function importSkill(
  source: string,
): Promise<{ ok: true; skill: AgentSkillInput } | { ok: false; error: string }> {
  const res = await fetch(`${base}/api/agents/skills/import`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ source }),
  });
  if (res.ok) {
    const data = (await res.json()) as SkillImportResponse;
    return { ok: true, skill: data.skill };
  }
  const data = await res.json().catch(() => ({ error: "import failed" }));
  return { ok: false, error: data.error ?? "import failed" };
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

export async function sendMessage(
  id: string,
  body: SendMessageRequest,
): Promise<RuntimeResult> {
  const res = await fetch(`${base}/api/agents/${id}/messages`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  // The server returns { ok: false, error } with a 4xx on failure — still JSON.
  return res.json() as Promise<RuntimeResult>;
}
