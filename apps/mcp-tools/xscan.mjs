#!/usr/bin/env node
/*
  occa-xscan — the attention pillar for Ape Check, spoken as an MCP stdio server.

  Zero-dependency, same family as secscan/chartlab: the gateway box runs this
  file directly (`node xscan.mjs` in an agent's .mcp.json), no install step. The
  MCP wire protocol is hand-rolled — newline-delimited JSON-RPC 2.0 over stdio.

  The OG principle governs this tool: it returns RAW, deterministic primitives —
  mention counts, author stats, timing, a KOL membership flag — and makes NO
  judgment. The call-taxonomy skill turns these numbers into the
  organic-vs-coordinated verdict. We deliberately do not buy a "smart mindshare"
  score from a vendor; the judgment is ours.

  Autonomous by design: `token_social(mint)` takes a bare CA and runs the whole
  pipeline itself — discover the X handle, profile the account, scan mentions
  across 1h/24h/7d, weigh the callers — in one call. Two drills expose the parts.

  Data sources (keys live on the gateway box env, never in the DB/catalog):
    - twitterapi.io  — accounts, mentions, callers   (X-API-Key: TWITTERAPI_KEY)
    - DexScreener    — socials for a listed token     (free, keyless)
    - Alchemy DAS    — metadata for a fresh mint       (ALCHEMY_KEY)
  Every layer is best-effort: a missing key or an empty source degrades to the
  next, and "nothing found" is itself a reported data point (GHOST / NONE), not
  a crash.
*/

import { createInterface } from "node:readline";
import { KOL_HANDLES } from "./kol-list.mjs";

const TWITTERAPI = "https://api.twitterapi.io";
const DEXSCREENER = "https://api.dexscreener.com/latest/dex/tokens";
const ALCHEMY_KEY = process.env.ALCHEMY_KEY || "";
const TWITTERAPI_KEY = process.env.TWITTERAPI_KEY || "";
const ALCHEMY_RPC = ALCHEMY_KEY
  ? `https://solana-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`
  : "";

// Trailing windows for mention velocity, and a per-window page cap so a loud
// token can't run the bill up (each page is 20 tweets, ~$0.003). Tune against
// real scans — these bound cost to roughly $0.03–0.06 per token_social run.
const WINDOWS = { "1h": 3600, "24h": 86_400, "7d": 604_800 };
const WINDOW_PAGES = { "1h": 1, "24h": 2, "7d": 3 };

// Caller-quality thresholds (the primitive DEFINITION of "low quality"; the
// skill decides what a given share MEANS). From the concept: tiny, brand-new,
// or bot-shaped (following far exceeds followers).
const TINY_FOLLOWERS = 500;
const FRESH_DAYS = 30;
const BOT_RATIO = 3;

// Case-insensitive KOL set, "@" stripped.
const KOL_SET = new Set(KOL_HANDLES.map((h) => h.replace(/^@/, "").toLowerCase()));

/* ------------------------------------------------------------- helpers -- */

async function getJson(url, headers = {}) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(15_000),
    headers: { accept: "application/json", ...headers },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).host}`);
  return res.json();
}

/** twitterapi.io GET with the box's key. Throws clearly if the key is unset. */
function tw(path, params = {}) {
  if (!TWITTERAPI_KEY) throw new Error("TWITTERAPI_KEY not set on the gateway box");
  const qs = new URLSearchParams(params).toString();
  return getJson(`${TWITTERAPI}${path}?${qs}`, { "X-API-Key": TWITTERAPI_KEY });
}

/** Alchemy Solana DAS JSON-RPC POST. */
async function alchemy(method, params) {
  if (!ALCHEMY_RPC) throw new Error("ALCHEMY_KEY not set on the gateway box");
  const res = await fetch(ALCHEMY_RPC, {
    method: "POST",
    signal: AbortSignal.timeout(15_000),
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from Alchemy`);
  const body = await res.json();
  if (body.error) throw new Error(`Alchemy: ${body.error.message ?? "rpc error"}`);
  return body.result;
}

/** twitter.com/<h> or x.com/<h> → the bare handle, or null. */
function parseHandle(url) {
  const m = String(url || "").match(/(?:twitter|x)\.com\/(?:#!\/)?@?([A-Za-z0-9_]{1,15})/i);
  const h = m?.[1];
  if (!h) return null;
  // Reject non-profile paths that share the domain.
  if (/^(home|search|intent|share|hashtag|i|explore|messages)$/i.test(h)) return null;
  return h;
}

/** twitterapi createdAt ("Tue Dec 10 07:00:30 +0000 2024") → epoch ms, or NaN. */
const tms = (s) => new Date(s).getTime();
const daysSince = (s) => (Date.now() - tms(s)) / 86_400_000;
const hoursSince = (s) => (Date.now() - tms(s)) / 3_600_000;
const round = (n, p = 1) => Math.round(n * 10 ** p) / 10 ** p;

const isKol = (userName) => KOL_SET.has(String(userName || "").toLowerCase());

/* ---------------------------------------------------------- discovery -- */

/*
  Three layers by token age (concept §handle discovery). Each returns
  { handle, source, confidence, symbol?, socialsPresent? } or null. token_social
  runs dex + metadata (they cross-check each other), falling back to X search.
*/

async function viaDex(mint) {
  const body = await getJson(`${DEXSCREENER}/${encodeURIComponent(mint)}`);
  const pair = (body?.pairs ?? [])[0];
  if (!pair) return null;
  const socials = pair.info?.socials ?? [];
  const twitter = socials.find((s) => s.type === "twitter");
  const handle = twitter ? parseHandle(twitter.url) : null;
  return {
    handle,
    source: handle ? "dex" : null,
    confidence: handle ? "medium" : null,
    symbol: pair.baseToken?.symbol ?? null,
    // Absence is a data point: a token trading with zero listed socials is a
    // story the skill should hear.
    socialsPresent: socials.length > 0,
  };
}

async function viaMetadata(mint) {
  const asset = await alchemy("getAsset", { id: mint });
  const content = asset?.content ?? {};
  const symbol = content.metadata?.symbol ?? asset?.token_info?.symbol ?? null;
  // Socials live in the OFF-CHAIN json, not the on-chain metadata block.
  let handle = null;
  const uri = content.json_uri;
  if (uri) {
    try {
      const meta = await getJson(uri);
      handle =
        parseHandle(meta.twitter) ||
        parseHandle(meta.twitter_url) ||
        parseHandle(meta.website) ||
        parseHandle(content.links?.external_url) ||
        null;
    } catch {
      // json_uri dead/blocked — metadata layer just yields no handle.
    }
  }
  return {
    handle,
    source: handle ? "metadata" : null,
    confidence: handle ? "high" : null,
    symbol,
  };
}

/*
  Fallback: who is posting the raw CA. Earliest + biggest posters are candidate
  official accounts; lowest confidence by nature. For a minutes-old mint this is
  sometimes the only social trace that exists.
*/
async function viaSearch(mint) {
  const body = await tw("/twitter/tweet/advanced_search", {
    query: `"${mint}"`,
    queryType: "Latest",
  });
  const tweets = body?.tweets ?? [];
  if (tweets.length === 0) return null;
  // Most-followed author posting the CA is the best guess at the official.
  const best = tweets
    .map((t) => t.author)
    .filter(Boolean)
    .sort((a, b) => (b.followers ?? 0) - (a.followers ?? 0))[0];
  const handle = best?.userName ?? null;
  return { handle, source: handle ? "search" : null, confidence: "low" };
}

async function discoverHandle(mint) {
  // dex (free) + metadata (authoritative) in parallel; they cross-check.
  const [dex, meta] = await Promise.allSettled([viaDex(mint), viaMetadata(mint)]);
  const d = dex.status === "fulfilled" ? dex.value : null;
  const m = meta.status === "fulfilled" ? meta.value : null;
  const symbol = m?.symbol ?? d?.symbol ?? null;
  const socialsPresent = d?.socialsPresent ?? false;

  const dexHandle = d?.handle ?? null;
  const metaHandle = m?.handle ?? null;

  // Cross-source mismatch is its own red flag (cloned/hijacked socials) — report
  // it as data, let the skill judge. Metadata is authoritative when both exist.
  let mismatch = null;
  if (dexHandle && metaHandle && dexHandle.toLowerCase() !== metaHandle.toLowerCase()) {
    mismatch = { metadata: metaHandle, dex: dexHandle };
  }

  const picked = m?.handle ? m : d?.handle ? d : null;
  if (picked) {
    return {
      handle: picked.handle,
      source: picked.source,
      confidence: picked.confidence,
      symbol,
      socialsPresent,
      mismatch,
    };
  }

  // Neither listed a handle — fall back to X search on the CA.
  const s = await viaSearch(mint).catch(() => null);
  return {
    handle: s?.handle ?? null,
    source: s?.source ?? null,
    confidence: s?.confidence ?? null,
    symbol,
    socialsPresent,
    mismatch,
  };
}

/* ------------------------------------------------------------ account -- */

async function accountPulse(handle) {
  const info = await tw("/twitter/user/info", { userName: handle });
  const u = info?.data;
  if (!u || info.status === "error") {
    return { handle, found: false, reason: info?.msg ?? "no account" };
  }

  // Recent posting cadence — the ALIVE vs DORMANT tell. One page (20) is enough
  // to read recency and 7d velocity.
  let posts7d = null;
  let hoursSinceLast = null;
  try {
    const last = await tw("/twitter/user/last_tweets", { userName: handle });
    const tweets = last?.tweets ?? [];
    if (tweets.length > 0) {
      hoursSinceLast = round(hoursSince(tweets[0].createdAt), 1);
      posts7d = tweets.filter((t) => daysSince(t.createdAt) <= 7).length;
      // Cap-aware: if the whole page is inside 7d there may be more.
      if (posts7d === tweets.length && last.has_next_page) posts7d = `${posts7d}+`;
    } else {
      posts7d = 0;
    }
  } catch {
    // last_tweets failed — liveness stays null, account stats still returned.
  }

  return {
    handle,
    found: true,
    account_age_days: round(daysSince(u.createdAt), 0),
    follower_count: u.followers ?? 0,
    following_count: u.following ?? 0,
    verified: Boolean(u.isBlueVerified),
    statuses_count: u.statusesCount ?? 0,
    posts_7d: posts7d,
    hours_since_last_post: hoursSinceLast,
  };
}

/* ----------------------------------------------------------- mentions -- */

/** searchWindow that never throws — a twitter outage/missing key degrades the
    window to empty-with-reason instead of failing the whole token_social. */
async function safeWindow(query, sinceSec, maxPages) {
  try {
    return await searchWindow(query, sinceSec, maxPages);
  } catch (err) {
    return { tweets: [], hasMore: false, error: err?.message ?? String(err) };
  }
}

/** One trailing-window search, paged up to maxPages. Returns the raw tweets. */
async function searchWindow(query, sinceSec, maxPages) {
  const until = Math.floor(Date.now() / 1000);
  const full = `${query} since_time:${sinceSec} until_time:${until}`;
  const tweets = [];
  let cursor = "";
  let hasMore = false;
  for (let page = 0; page < maxPages; page++) {
    const body = await tw("/twitter/tweet/advanced_search", {
      query: full,
      queryType: "Latest",
      cursor,
    });
    for (const t of body?.tweets ?? []) tweets.push(t);
    hasMore = Boolean(body?.has_next_page);
    cursor = body?.next_cursor ?? "";
    if (!hasMore || !cursor) break;
  }
  return { tweets, hasMore };
}

/** Dedupe callers by author id and turn the crowd into weighted primitives. */
function callerStats(tweets) {
  const byId = new Map();
  for (const t of tweets) {
    const a = t.author;
    if (a?.id && !byId.has(a.id)) byId.set(a.id, a);
  }
  const callers = [...byId.values()].map((a) => {
    const followers = a.followers ?? 0;
    const following = a.following ?? 0;
    return {
      userName: a.userName,
      followers,
      age_days: round(daysSince(a.createdAt), 0),
      verified: Boolean(a.isBlueVerified),
      following_followers_ratio: round(following / (followers + 1), 2),
      kol_hit: isKol(a.userName),
    };
  });

  const lowQuality = callers.filter(
    (c) =>
      c.followers < TINY_FOLLOWERS ||
      c.age_days < FRESH_DAYS ||
      c.following_followers_ratio > BOT_RATIO,
  ).length;

  // Log-weighted reach so 200 nano-accounts never outweigh a few real ones.
  const reach = round(
    callers.reduce((sum, c) => sum + Math.log10(c.followers + 1), 0),
    2,
  );

  return {
    unique_authors: callers.length,
    low_quality_share: callers.length ? round(lowQuality / callers.length, 2) : 0,
    weighted_reach: reach,
    kol_hits: callers.filter((c) => c.kol_hit).map((c) => c.userName),
    // Top callers by followers, trimmed so the model isn't drowned.
    top_callers: callers.sort((a, b) => b.followers - a.followers).slice(0, 15),
  };
}

/* -------------------------------------------------------------- tools -- */

async function tokenSocial({ mint }) {
  if (!mint) throw new Error("mint is required");

  const disc = await discoverHandle(mint);
  const symbol = disc.symbol;
  // CA is unique/low-noise; add the ticker so an on-fire cashtag is caught too.
  const term = symbol ? `"${mint}" OR "$${symbol}"` : `"${mint}"`;

  // Account profile (only if we found a handle) and the three windows, parallel.
  // Everything here is best-effort: a twitter outage leaves the discovered
  // handle intact and reports mentions as unavailable rather than failing.
  const now = Math.floor(Date.now() / 1000);
  const [account, w1h, w24h, w7d] = await Promise.all([
    disc.handle
      ? accountPulse(disc.handle).catch((e) => ({ handle: disc.handle, found: false, reason: e.message }))
      : Promise.resolve({ found: false, reason: "no handle discovered" }),
    safeWindow(term, now - WINDOWS["1h"], WINDOW_PAGES["1h"]),
    safeWindow(term, now - WINDOWS["24h"], WINDOW_PAGES["24h"]),
    safeWindow(term, now - WINDOWS["7d"], WINDOW_PAGES["7d"]),
  ]);

  const count = (w) => (w.error ? "unavailable" : w.hasMore ? `${w.tweets.length}+` : w.tweets.length);
  // Caller quality is read off the 24h crowd — recent and broad enough to judge.
  const callers = callerStats(w24h.tweets);
  const mentionsError = w1h.error && w24h.error && w7d.error ? w24h.error : undefined;

  return {
    mint,
    symbol,
    handle: {
      handle: disc.handle,
      source: disc.source, // metadata (authoritative) / dex / search (guess)
      confidence: disc.confidence,
      socials_listed: disc.socialsPresent,
      mismatch: disc.mismatch, // cross-source handle disagreement, or null
    },
    account,
    mentions: {
      mentions_1h: count(w1h),
      mentions_24h: count(w24h),
      mentions_7d: count(w7d),
      unique_authors_24h: callers.unique_authors,
      ...(mentionsError ? { unavailable: mentionsError } : {}),
    },
    callers,
    // Windows/caps disclosed so the skill knows counts are floors when capped.
    meta: {
      query: term,
      window_page_caps: WINDOW_PAGES,
      note: "counts suffixed with + hit the page cap and are floors; KOL hits are a curated-list membership check, not a judgment",
    },
  };
}

async function mentionScan({ term, window }) {
  if (!term) throw new Error("term is required");
  const win = String(window || "24h");
  const seconds = WINDOWS[win];
  if (!seconds) throw new Error(`unknown window "${win}" — use one of: ${Object.keys(WINDOWS).join(", ")}`);
  const query = /^[@$"]/.test(term) ? term : `"${term}"`;
  const { tweets, hasMore } = await searchWindow(
    query,
    Math.floor(Date.now() / 1000) - seconds,
    WINDOW_PAGES[win],
  );
  return {
    term,
    window: win,
    mentions: hasMore ? `${tweets.length}+` : tweets.length,
    ...callerStats(tweets),
  };
}

async function accountPulseTool({ handle }) {
  if (!handle) throw new Error("handle is required");
  return accountPulse(String(handle).replace(/^@/, ""));
}

/* ------------------------------------------------------------- protocol -- */

const TOOLS = [
  {
    name: "token_social",
    description:
      "Autonomous attention scan for a Solana token from a bare mint/CA. Discovers the token's X handle (token metadata → DEX socials → CA search, with source + confidence), profiles the account (age, followers, posting cadence), scans mentions of the CA + ticker across 1h/24h/7d, and weighs the callers (reach, low-quality share, KOL hits). Returns raw primitives only — no verdict.",
    inputSchema: {
      type: "object",
      properties: { mint: { type: "string", description: "Solana token mint / contract address (base58)" } },
      required: ["mint"],
    },
    handler: tokenSocial,
  },
  {
    name: "mention_scan",
    description:
      "Drill: re-search an arbitrary term (a changed ticker, a rival handle, a narrative phrase) over one window and weigh the callers. Windows: 1h, 24h, 7d.",
    inputSchema: {
      type: "object",
      properties: {
        term: { type: "string", description: "search term — a CA, $ticker, @handle, or phrase" },
        window: { type: "string", description: "1h, 24h, or 7d (default 24h)" },
      },
      required: ["term"],
    },
    handler: mentionScan,
  },
  {
    name: "account_pulse",
    description:
      "Drill: profile one X account — age, followers/following, verified, recent posting cadence, hours since last post. Use to verify a suspected clone or check a flagged caller.",
    inputSchema: {
      type: "object",
      properties: { handle: { type: "string", description: "X handle, with or without @" } },
      required: ["handle"],
    },
    handler: accountPulseTool,
  },
];

const reply = (id, result) =>
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, result })}\n`);
const replyError = (id, code, message) =>
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } })}\n`);

async function handle(msg) {
  const { id, method, params } = msg;
  if (id === undefined || id === null) return; // notifications get no response

  switch (method) {
    case "initialize":
      return reply(id, {
        protocolVersion: params?.protocolVersion ?? "2025-06-18",
        capabilities: { tools: {} },
        serverInfo: { name: "occa-xscan", version: "0.1.0" },
      });
    case "ping":
      return reply(id, {});
    case "tools/list":
      return reply(id, {
        tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
      });
    case "tools/call": {
      const tool = TOOLS.find((t) => t.name === params?.name);
      if (!tool) return replyError(id, -32602, `unknown tool: ${params?.name}`);
      try {
        const result = await tool.handler(params?.arguments ?? {});
        return reply(id, { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] });
      } catch (err) {
        return reply(id, {
          content: [{ type: "text", text: `Scan failed: ${err?.message ?? String(err)}` }],
          isError: true,
        });
      }
    }
    default:
      return replyError(id, -32601, `method not found: ${method}`);
  }
}

// Exit only after every in-flight handler replies — a piped stdin closes the
// moment the last line is written, while tool calls are still fetching.
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
    return; // not JSON — ignore, never crash the transport
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
