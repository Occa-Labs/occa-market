#!/usr/bin/env node
/*
  occa-chartlab — on-chain chart data + deterministic indicators, as an MCP
  stdio server. Same zero-dependency pattern as secscan.mjs (handmade
  newline-delimited JSON-RPC; no install step on the gateway box).

  Data: DexPaprika (free, keyless, ~10k req/day) — Solana-first (PumpSwap /
  Raydium / Orca, i.e. pump.fun tokens after graduation) but every DexPaprika
  network works via the `network` argument.

  The point of this server: the MODEL must never do indicator arithmetic.
  pool_chart computes EMA / RSI / ATR / swings / volume stats from raw OHLCV
  right here, deterministically; the agent's job is interpretation.
*/

import { createInterface } from "node:readline";

const API = "https://api.dexpaprika.com";

const INTERVALS = {
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "30m": 1800,
  "1h": 3600,
  "6h": 21600,
  "12h": 43200,
  "24h": 86400,
};

async function getJson(url) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(15_000),
    headers: { accept: "application/json" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).host}`);
  return res.json();
}

const looksLikeAddress = (s) =>
  /^0x[0-9a-fA-F]{40}$/.test(s) || /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s);

const round = (v, dp = 6) =>
  v == null || Number.isNaN(v) ? null : Number(Number(v).toPrecision(dp));

/* ------------------------------------------------------------ indicators -- */

function ema(closes, period) {
  if (closes.length < period) return null;
  const k = 2 / (period + 1);
  let value = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < closes.length; i++) value = closes[i] * k + value * (1 - k);
  return value;
}

function rsi(closes, period = 14) {
  if (closes.length < period + 1) return null;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gain += d;
    else loss -= d;
  }
  gain /= period;
  loss /= period;
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    gain = (gain * (period - 1) + Math.max(d, 0)) / period;
    loss = (loss * (period - 1) + Math.max(-d, 0)) / period;
  }
  if (loss === 0) return 100;
  return 100 - 100 / (1 + gain / loss);
}

function atrPercent(candles, period = 14) {
  if (candles.length < period + 1) return null;
  const trs = [];
  for (let i = 1; i < candles.length; i++) {
    const prevClose = candles[i - 1].close;
    trs.push(
      Math.max(
        candles[i].high - candles[i].low,
        Math.abs(candles[i].high - prevClose),
        Math.abs(candles[i].low - prevClose),
      ),
    );
  }
  let atr = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < trs.length; i++) atr = (atr * (period - 1) + trs[i]) / period;
  const last = candles[candles.length - 1].close;
  return last > 0 ? (atr / last) * 100 : null;
}

/** Fractal swing points: high above (low below) the 2 candles on each side. */
function swings(candles, keep = 4) {
  const highs = [];
  const lows = [];
  for (let i = 2; i < candles.length - 2; i++) {
    const w = candles.slice(i - 2, i + 3);
    if (w.every((c, j) => j === 2 || c.high <= candles[i].high)) {
      highs.push({ time: candles[i].time_open, price: round(candles[i].high) });
    }
    if (w.every((c, j) => j === 2 || c.low >= candles[i].low)) {
      lows.push({ time: candles[i].time_open, price: round(candles[i].low) });
    }
  }
  return { recent_swing_highs: highs.slice(-keep), recent_swing_lows: lows.slice(-keep) };
}

/* ---------------------------------------------------------------- tools -- */

async function resolveToken({ token, network = "solana" }) {
  const query = String(token || "").trim();
  if (!query) throw new Error("token is required — a mint/contract address or a name to search");

  // Name/ticker → search across DexPaprika, surface address candidates.
  if (!looksLikeAddress(query)) {
    const found = await getJson(`${API}/search?query=${encodeURIComponent(query)}`);
    const tokens = (found.tokens ?? []).slice(0, 8).map((t) => ({
      address: t.id,
      network: t.chain,
      name: t.name,
      symbol: t.symbol,
    }));
    if (tokens.length === 0) {
      return { match: "none", note: `nothing on any indexed DEX matches "${query}"` };
    }
    return {
      match: "candidates",
      note: "not an address — pick the right one and resolve again by address",
      candidates: tokens,
    };
  }

  const enc = encodeURIComponent(query);
  const [details, poolsRes] = await Promise.allSettled([
    getJson(`${API}/networks/${network}/tokens/${enc}`),
    getJson(
      `${API}/networks/${network}/tokens/${enc}/pools?limit=5&order_by=volume_usd&sort=desc`,
    ),
  ]);

  const pools = poolsRes.status === "fulfilled" ? (poolsRes.value.pools ?? []) : [];
  const t = details.status === "fulfilled" ? details.value : null;

  const isPumpMint = network === "solana" && query.endsWith("pump");
  let note;
  if (pools.length === 0) {
    note = isPumpMint
      ? "no DEX pools indexed — this pump.fun token has most likely NOT graduated yet (still on the bonding curve), so there are no pool candles to chart"
      : "no DEX pools indexed on this network — wrong network, or the token has no on-chain liquidity";
  } else if (isPumpMint) {
    note = "pump.fun origin mint, graduated — PumpSwap/Raydium pools are live";
  }

  return {
    token: t && {
      address: t.id ?? query,
      name: t.name,
      symbol: t.symbol,
      decimals: t.decimals,
      price_usd: round(t.summary?.price_usd ?? t.price_usd),
      fdv_usd: round(t.summary?.fdv ?? t.fdv, 4),
      liquidity_usd: round(t.summary?.liquidity_usd, 4),
    },
    pools: pools.map((p) => ({
      pool: p.id,
      dex: p.dex_name,
      volume_usd_24h: round(p.volume_usd, 4),
      transactions_24h: p.transactions,
      price_usd: round(p.price_usd),
      change_24h_percent: round(p.last_price_change_usd_24h, 3),
      created_at: p.created_at,
    })),
    note,
  };
}

async function poolChart({ pool, network = "solana", interval = "1h", candles = 100 }) {
  const sec = INTERVALS[interval];
  if (!sec) {
    throw new Error(`unsupported interval "${interval}" — pick one of: ${Object.keys(INTERVALS).join(", ")}`);
  }
  const n = Math.min(Math.max(Number(candles) || 100, 20), 300);
  const start = new Date(Date.now() - n * sec * 1000).toISOString();
  const rows = await getJson(
    `${API}/networks/${network}/pools/${encodeURIComponent(pool)}/ohlcv?start=${encodeURIComponent(start)}&limit=${n}&interval=${interval}`,
  );
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("no candles returned — pool too young for this interval, or wrong pool/network");
  }

  const closes = rows.map((c) => c.close);
  const vols = rows.map((c) => Number(c.volume) || 0);
  const last = rows[rows.length - 1];
  const windowHigh = Math.max(...rows.map((c) => c.high));
  const windowLow = Math.min(...rows.map((c) => c.low));
  const half = Math.floor(rows.length / 2);
  const volFirstHalf = vols.slice(0, half).reduce((a, b) => a + b, 0);
  const volSecondHalf = vols.slice(half).reduce((a, b) => a + b, 0);
  const avgVol = vols.reduce((a, b) => a + b, 0) / vols.length;
  const last5Avg = vols.slice(-5).reduce((a, b) => a + b, 0) / Math.min(5, vols.length);

  const e20 = ema(closes, 20);
  const e50 = ema(closes, 50);
  const e200 = ema(closes, 200);

  return {
    pool,
    network,
    interval,
    candle_count: rows.length,
    window: { from: rows[0].time_open, to: last.time_close },
    price: {
      last_close: round(last.close),
      change_over_window_percent: round(((last.close - rows[0].open) / rows[0].open) * 100, 4),
      window_high: round(windowHigh),
      window_low: round(windowLow),
      drawdown_from_window_high_percent: round(((last.close - windowHigh) / windowHigh) * 100, 4),
    },
    indicators: {
      ema20: round(e20),
      ema50: round(e50),
      ema200: round(e200),
      price_vs_ema: {
        above_ema20: e20 == null ? null : last.close > e20,
        above_ema50: e50 == null ? null : last.close > e50,
        above_ema200: e200 == null ? null : last.close > e200,
      },
      rsi14: round(rsi(closes), 4),
      atr14_percent_of_price: round(atrPercent(rows), 4),
    },
    structure: swings(rows),
    volume: {
      total: round(vols.reduce((a, b) => a + b, 0), 6),
      per_candle_avg: round(avgVol, 4),
      last5_vs_avg_ratio: avgVol > 0 ? round(last5Avg / avgVol, 3) : null,
      second_half_vs_first_half_ratio:
        volFirstHalf > 0 ? round(volSecondHalf / volFirstHalf, 3) : null,
    },
    note:
      rows.length < n
        ? `asked for ${n} candles, pool only has ${rows.length} at ${interval} — young pool; EMA/RSI fields null when the window is too short`
        : undefined,
  };
}

/* ------------------------------------------------------------- protocol -- */

const TOOLS = [
  {
    name: "resolve_token",
    description:
      "Resolve a token to its live DEX pools (Solana-first: PumpSwap/Raydium/Orca — pump.fun tokens appear after graduation). Takes a mint/contract address (or a name/ticker to search), returns token info + top pools by volume. Empty pools on a *pump mint = not graduated yet.",
    inputSchema: {
      type: "object",
      properties: {
        token: { type: "string", description: "mint/contract address, or a name/ticker to search" },
        network: { type: "string", description: "dexpaprika network id, default solana (also: ethereum, base, bsc, …)" },
      },
      required: ["token"],
    },
    handler: resolveToken,
  },
  {
    name: "pool_chart",
    description:
      "OHLCV for a DEX pool plus deterministically computed indicators: EMA 20/50/200, RSI14, ATR14 (% of price), fractal swing highs/lows, window high/low + drawdown, and volume trend. Intervals: " +
      Object.keys(INTERVALS).join(", ") +
      ". Use 1m/5m for young pump.fun pools, 1h/24h for established ones.",
    inputSchema: {
      type: "object",
      properties: {
        pool: { type: "string", description: "pool address (from resolve_token)" },
        network: { type: "string", description: "dexpaprika network id, default solana" },
        interval: { type: "string", description: "candle interval, default 1h" },
        candles: { type: "number", description: "how many candles (20–300), default 100" },
      },
      required: ["pool"],
    },
    handler: poolChart,
  },
];

const reply = (id, result) =>
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, result })}\n`);
const replyError = (id, code, message) =>
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } })}\n`);

async function handle(msg) {
  const { id, method, params } = msg;
  if (id === undefined || id === null) return;

  switch (method) {
    case "initialize":
      return reply(id, {
        protocolVersion: params?.protocolVersion ?? "2025-06-18",
        capabilities: { tools: {} },
        serverInfo: { name: "occa-chartlab", version: "0.1.0" },
      });
    case "ping":
      return reply(id, {});
    case "tools/list":
      return reply(id, {
        tools: TOOLS.map(({ name, description, inputSchema }) => ({
          name,
          description,
          inputSchema,
        })),
      });
    case "tools/call": {
      const tool = TOOLS.find((t) => t.name === params?.name);
      if (!tool) return replyError(id, -32602, `unknown tool: ${params?.name}`);
      try {
        const result = await tool.handler(params?.arguments ?? {});
        return reply(id, {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        });
      } catch (err) {
        return reply(id, {
          content: [{ type: "text", text: `Chart fetch failed: ${err?.message ?? String(err)}` }],
          isError: true,
        });
      }
    }
    default:
      return replyError(id, -32601, `method not found: ${method}`);
  }
}

// Exit only after every in-flight handler has replied (piped-stdin safety).
let inFlight = 0;
let stdinClosed = false;
const maybeExit = () => {
  if (stdinClosed && inFlight === 0) process.exit(0);
};

const rl = createInterface({ input: process.stdin });
rl.on("line", (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let msg;
  try {
    msg = JSON.parse(trimmed);
  } catch {
    return;
  }
  inFlight += 1;
  void handle(msg)
    .catch((err) => {
      if (msg.id !== undefined && msg.id !== null) {
        replyError(msg.id, -32603, err?.message ?? "internal error");
      }
    })
    .finally(() => {
      inFlight -= 1;
      maybeExit();
    });
});
rl.on("close", () => {
  stdinClosed = true;
  maybeExit();
});
