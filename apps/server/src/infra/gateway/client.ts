/*
  HTTP client for a provider's Claude Gateway (BYORT mode).

  Ported and adapted from @occa/adapter-claude-code (gateway-client.ts). The
  market is standalone and does not import the OCCA monorepo, so the wire types
  are inlined here rather than imported from @occa/gateway-claude-code/wire.

  Endpoints (all require `Authorization: Bearer <gateway token>`):
    GET  /v1/health       — reachable + bearer valid + claude logged in
    POST /v1/seed         — write an agent's workspace files
    POST /v1/run          — run one turn; streams NDJSON, ends with a result line
    POST /v1/deprovision  — remove an agent's workspace

  Note: the upstream /v1/run reconnects on a mid-run stream drop (runs are
  buffered per sessionKey on the gateway). That resilience is trimmed here for
  MVP — a single attempt — and can be restored from the upstream client.
*/

export type GatewayTarget = { gatewayUrl: string; apiKey?: string };

/** One live turn event off the /v1/run stream. */
export type GatewayStreamEvent = {
  kind: "assistant_text" | "tool_use" | "tool_result" | "error";
  text?: string;
  toolName?: string;
  toolInput?: unknown;
  toolResult?: string;
  isError?: boolean;
};

/** Final result line of a /v1/run turn. Mirrors the gateway's RunClaudeResult. */
export type GatewayRunResult = {
  ok: boolean;
  reply: string;
  sessionId: string | null;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cachedTokensIn: number;
  } | null;
  costUsd: number | null;
  error?: string;
  reason?: string;
};

export type GatewayRunBody = {
  externalAgentId: string;
  prompt: string;
  model: string;
  sessionKey: string;
  /** Small extra instructions; persona/skills ride in the seeded workspace. */
  appendSystemPrompt?: string | null;
  /** Empty/omitted = no tools (pure text reply, for chat). */
  allowedTools?: string[] | null;
  disallowedTools?: string[] | null;
  timeoutMs?: number;
  maxBudgetUsd?: number;
};

function headers(apiKey?: string): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) h.Authorization = `Bearer ${apiKey}`;
  return h;
}

function runError(error: string, reason: string): GatewayRunResult {
  return {
    ok: false,
    reply: "",
    sessionId: null,
    usage: null,
    costUsd: null,
    error,
    reason,
  };
}

/** GET /v1/health — is the gateway reachable, the bearer valid, claude ready. */
export async function gatewayHealth(
  target: GatewayTarget,
): Promise<{ ok: boolean; error?: string; reason?: string }> {
  try {
    const res = await fetch(`${target.gatewayUrl}/v1/health`, {
      method: "GET",
      headers: headers(target.apiKey),
    });
    if (res.status === 401) {
      return { ok: false, error: "gateway_unauthorized", reason: "bad gateway bearer" };
    }
    if (!res.ok) {
      return { ok: false, error: "gateway_unreachable", reason: `gateway HTTP ${res.status}` };
    }
    const body = (await res.json()) as { ok?: boolean; error?: string; reason?: string };
    return body.ok
      ? { ok: true }
      : { ok: false, error: body.error ?? "gateway_unreachable", reason: body.reason };
  } catch (err) {
    return {
      ok: false,
      error: "gateway_unreachable",
      reason: err instanceof Error ? err.message : "gateway fetch failed",
    };
  }
}

/** POST /v1/seed — push an agent's workspace files to the gateway box. */
export async function gatewaySeed(
  target: GatewayTarget,
  externalAgentId: string,
  files: Array<{ filename: string; content: string }>,
): Promise<{ ok: boolean; pushed: number; error?: string; reason?: string }> {
  try {
    const res = await fetch(`${target.gatewayUrl}/v1/seed`, {
      method: "POST",
      headers: headers(target.apiKey),
      body: JSON.stringify({ externalAgentId, files }),
    });
    if (!res.ok) {
      return { ok: false, pushed: 0, error: "seed_failed", reason: `gateway HTTP ${res.status}` };
    }
    const body = (await res.json()) as { ok?: boolean; pushed?: number };
    return { ok: body.ok === true, pushed: body.pushed ?? 0 };
  } catch (err) {
    return {
      ok: false,
      pushed: 0,
      error: "seed_failed",
      reason: err instanceof Error ? err.message : "gateway seed failed",
    };
  }
}

/** POST /v1/deprovision — best-effort workspace removal on the gateway box. */
export async function gatewayDeprovision(
  target: GatewayTarget,
  externalAgentId: string,
): Promise<void> {
  try {
    await fetch(`${target.gatewayUrl}/v1/deprovision`, {
      method: "POST",
      headers: headers(target.apiKey),
      body: JSON.stringify({ externalAgentId }),
    });
  } catch {
    /* best-effort */
  }
}

/**
 * POST /v1/run — run one turn on the gateway and return the final result.
 * Reads the NDJSON stream: `{t:"event"}` lines forward to `onEvent`, the final
 * `{t:"result"}` line carries the result.
 */
export async function gatewayRun(
  target: GatewayTarget,
  body: GatewayRunBody,
  onEvent?: (event: GatewayStreamEvent) => void,
): Promise<GatewayRunResult> {
  let res: Response;
  try {
    res = await fetch(`${target.gatewayUrl}/v1/run`, {
      method: "POST",
      headers: headers(target.apiKey),
      body: JSON.stringify(body),
    });
  } catch (err) {
    return runError(
      "gateway_unreachable",
      err instanceof Error ? err.message : "gateway run fetch failed",
    );
  }

  if (res.status === 401) return runError("gateway_unauthorized", "bad gateway bearer");
  if (!res.ok || !res.body) return runError("prompt_failed", `gateway HTTP ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let result: GatewayRunResult | null = null;

  const routeLine = (line: string): void => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let parsed: { t?: string; event?: GatewayStreamEvent; result?: GatewayRunResult };
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return;
    }
    if (parsed.t === "event" && parsed.event) onEvent?.(parsed.event);
    else if (parsed.t === "result" && parsed.result) result = parsed.result;
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

  return result ?? runError("gateway_unreachable", "gateway closed without a result line");
}
