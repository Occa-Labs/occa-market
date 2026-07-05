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
  /** provider_rate_limited only: ISO moment the backend's window frees up. */
  retryAt?: string;
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

function runError(error: string, reason: string, retryAt?: string): GatewayRunResult {
  return {
    ok: false,
    reply: "",
    sessionId: null,
    usage: null,
    costUsd: null,
    error,
    reason,
    ...(retryAt ? { retryAt } : {}),
  };
}

/*
  Rate-limit normalization. The provider backend (a Claude subscription seat)
  has a rolling usage window; when it trips, the failure arrives as a 429 or
  as an error/reason mentioning the limit. Normalize those to one stable code
  the UI can turn into "at capacity, frees up around …" — with the reset
  moment parsed out when the message carries one.
*/
const RATE_LIMIT_RE = /rate.?limit|usage limit|too many requests|overloaded|quota exceeded|limit reached/i;

/** Best-effort reset-moment parse: "in 25 minutes", "resets 3am", "resets 14:30". */
export function parseRetryAt(text: string, now: Date = new Date()): string | undefined {
  const rel = /in\s+(\d+)\s*(second|minute|min|hour|hr)s?/i.exec(text);
  if (rel) {
    const n = Number(rel[1]);
    const unitMs = /^s/i.test(rel[2]) ? 1000 : /^h/i.test(rel[2]) ? 3600_000 : 60_000;
    return new Date(now.getTime() + n * unitMs).toISOString();
  }

  const abs = /resets?\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i.exec(text);
  if (abs) {
    let hour = Number(abs[1]);
    const minute = abs[2] ? Number(abs[2]) : 0;
    const meridiem = abs[3]?.toLowerCase();
    if (meridiem === "pm" && hour < 12) hour += 12;
    if (meridiem === "am" && hour === 12) hour = 0;
    if (hour > 23 || minute > 59) return undefined;
    // The message gives no timezone — read it as UTC and roll to tomorrow if
    // that moment already passed. Approximate, but honest enough for a hint.
    const at = new Date(Date.UTC(
      now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour, minute,
    ));
    if (at.getTime() <= now.getTime()) at.setUTCDate(at.getUTCDate() + 1);
    return at.toISOString();
  }

  return undefined;
}

/** Rewrite a failed result to provider_rate_limited when it smells like one. */
function normalizeRunFailure(result: GatewayRunResult): GatewayRunResult {
  if (result.ok) return result;
  const text = `${result.error ?? ""} ${result.reason ?? ""}`;
  if (result.error === "provider_rate_limited" || !RATE_LIMIT_RE.test(text)) {
    return result;
  }
  return {
    ...result,
    error: "provider_rate_limited",
    retryAt: result.retryAt ?? parseRetryAt(text),
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
  if (res.status === 429) {
    // Retry-After is seconds (or an HTTP date) when the gateway sends one.
    const after = res.headers.get("retry-after");
    const seconds = after ? Number(after) : NaN;
    const retryAt = Number.isFinite(seconds)
      ? new Date(Date.now() + seconds * 1000).toISOString()
      : after && !Number.isNaN(Date.parse(after))
        ? new Date(after).toISOString()
        : undefined;
    return runError("provider_rate_limited", "gateway HTTP 429", retryAt);
  }
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

  return result
    ? normalizeRunFailure(result)
    : runError("gateway_unreachable", "gateway closed without a result line");
}
