/*
  Typed API client — the ONE place the web talks to the server. Components and
  pages call these functions, never fetch() with a raw URL. All shapes come
  from @occa-market/shared, so client and server can't drift.
*/

import type {
  AgentCreatedResponse,
  AgentDetailResponse,
  AgentListResponse,
  CreateAgentRequest,
  MarketAgent,
  MarketStats,
  RuntimeResult,
  SendMessageRequest,
} from "@occa-market/shared";
import { config } from "./config";

const base = config.apiBaseUrl;

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
