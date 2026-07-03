/*
  Hand-authored agent detail records (raw data) + a generic fallback.

  Public-framing note (blueprint §12): everything here describes the agent's
  WORK / OUTPUT, never raw inference or the provider's subscription.
*/

import type { AgentDetail, AgentSkill } from "@occa-market/shared";
import type { SeedAgent } from "./catalog";

// Seed skills are authored as plain names; wrap them as public skill labels.
const sk = (name: string): AgentSkill => ({ name, description: "" });

export const AGENT_DETAILS: Record<string, AgentDetail> = {
  "degen-scout": {
    longDescription:
      "Degen Scout watches new token launches across chains in real time and hands back a plain read of what each one actually is — contract, liquidity, holder distribution, and the obvious risks. Ask about any ticker or contract and it returns a clean breakdown you can act on, before you ape in.",
    capabilities: [
      "Surfaces fresh launches across chains as they happen",
      "Breaks down contract, liquidity, and holder distribution",
      "Flags the obvious ways a token can hurt you",
    ],
    skills: [
      "Launch monitoring",
      "Contract analysis",
      "Holder distribution",
      "Risk flagging",
    ].map(sk),
    tools: ["DEX pair feed", "On-chain RPC", "Token sniffer", "Block explorer"],
    workflow: [
      { text: "Listen for new pairs across tracked DEXes", uses: ["DEX pair feed"] },
      { text: "Pull contract, liquidity, and holder data", uses: ["On-chain RPC", "Block explorer"] },
      {
        text: "Run risk checks: mint authority, LP lock, wallet concentration",
        uses: ["Token sniffer", "Risk flagging"],
      },
      { text: "Return a plain-language breakdown with the flags", uses: [] },
    ],
    examplePrompts: [
      "New launches today",
      "Any honeypots in the last 24h?",
      "Show me the safest new pairs",
      "Is this contract safe?",
    ],
    sampleOutput: {
      prompt: "new launches",
      blocks: [
        {
          type: "summary",
          text: "Most new pairs are noise. The ones below cleared the first filter and are worth a closer look — anything thin, mint-open, or honeypot is flagged. Sorted safest first, so the riskiest sit at the bottom.",
        },
        {
          type: "launchScan",
          launches: [
            {
              ticker: "$GIGA",
              age: "22h",
              ageHours: 22,
              liquidity: "$120k",
              status: "ok",
              note: "Verified, mint renounced, LP locked 180d",
            },
            {
              ticker: "$MOON",
              age: "6h",
              ageHours: 6,
              liquidity: "$31.4k",
              status: "ok",
              note: "Clean contract, healthy holder spread",
            },
            {
              ticker: "$PEPE3",
              age: "10h",
              ageHours: 10,
              liquidity: "$15.6k",
              status: "warn",
              note: "Mint authority still active — can inflate supply",
            },
            {
              ticker: "$WAGMI",
              age: "2h",
              ageHours: 2,
              liquidity: "$42.0k",
              status: "warn",
              note: "LP locked, but top 10 wallets hold 48%",
            },
            {
              ticker: "$TURBO2",
              age: "40m",
              ageHours: 0.7,
              liquidity: "$8.1k",
              status: "warn",
              note: "Thin liquidity, a small sell moves the price",
            },
            {
              ticker: "$RUGME",
              age: "9m",
              ageHours: 0.15,
              liquidity: "$2.0k",
              status: "bad",
              note: "Honeypot — sells disabled in the contract",
            },
          ],
        },
      ],
    },
    chatReplies: [
      [
        { type: "verdict", label: "Caution", level: "warn" },
        {
          type: "summary",
          text: "The contract is verified and mint is renounced, so no surprise supply. But liquidity is thin and the top 10 wallets hold 48% — one of them dumping would tank the price. Tradeable, but size small.",
        },
        {
          type: "metrics",
          items: [
            { label: "Liquidity", value: "$42.0k" },
            { label: "Holders", value: "312" },
            { label: "Top 10", value: "48%" },
            { label: "Mint", value: "Renounced" },
          ],
        },
        {
          type: "signals",
          items: [
            { label: "Contract verified", status: "ok" },
            { label: "Mint authority renounced", status: "ok" },
            { label: "LP locked for 90 days", status: "ok" },
            { label: "Top 10 wallets hold 48% of supply", status: "warn" },
          ],
        },
      ],
    ],
    uptime: 99.2,
    categoryRank: 1,
    activity: [
      { text: "Scanned 0x4f…a91c · flagged honeypot", time: "14:09" },
      { text: "Breakdown for $MOON delivered", time: "14:02" },
      { text: "Scanned 0x18…02de · clean", time: "13:55" },
      { text: "Flagged risk on $WAGMI launch", time: "13:48" },
      { text: "Surfaced 6 new launches", time: "13:31" },
    ],
  },
  "chart-whisperer": {
    longDescription:
      "Chart Whisperer reads any ticker and hands back a clean technical breakdown — trend, key levels, and indicator reads in plain language. Point it at a token and it returns a structured view of where price sits and what the chart is saying, without the noise.",
    capabilities: [
      "Reads trend, momentum, and structure on any ticker",
      "Marks the support and resistance that matter",
      "Translates indicators into a plain call",
    ],
    skills: [
      "Technical analysis",
      "Trend detection",
      "Support / resistance",
      "Indicator reads",
    ].map(sk),
    tools: ["Price feed", "OHLCV history", "Indicator engine"],
    workflow: [
      { text: "Pull OHLCV history for the ticker", uses: ["OHLCV history"] },
      { text: "Compute indicators: RSI, MACD, moving averages", uses: ["Indicator engine"] },
      { text: "Detect trend, key levels, and patterns", uses: ["Trend detection"] },
      { text: "Return a plain technical breakdown", uses: [] },
    ],
    examplePrompts: [
      "Break down $SOL",
      "Is $ETH bullish right now?",
      "Key levels for $BTC",
    ],
    sampleOutput: {
      prompt: "break down $SOL",
      blocks: [
        { type: "verdict", label: "Bullish", level: "ok" },
        {
          type: "summary",
          text: "$SOL is in an uptrend with room before resistance. Structure is intact, though momentum is cooling on the 4h.",
        },
        {
          type: "metrics",
          items: [
            { label: "Trend", value: "Up" },
            { label: "RSI", value: "62" },
            { label: "Support", value: "$142" },
            { label: "Resistance", value: "$168" },
          ],
        },
        {
          type: "signals",
          items: [
            { label: "Higher highs intact", status: "ok" },
            { label: "Holding above the 50 & 200 MA", status: "ok" },
            { label: "Momentum cooling on the 4h", status: "warn" },
          ],
        },
      ],
    },
    chatReplies: [
      [
        { type: "verdict", label: "Neutral", level: "warn" },
        {
          type: "summary",
          text: "$ETH is ranging between support and resistance with momentum flat on the daily. There's no clean trade here until it breaks one side of the range — wait for the move.",
        },
        {
          type: "metrics",
          items: [
            { label: "Trend", value: "Flat" },
            { label: "RSI", value: "49" },
            { label: "Support", value: "$3.2k" },
            { label: "Resistance", value: "$3.6k" },
          ],
        },
        {
          type: "signals",
          items: [
            { label: "Holding the range low", status: "ok" },
            { label: "Momentum flat on the daily", status: "warn" },
            { label: "Volume declining into the range", status: "warn" },
          ],
        },
      ],
    ],
    uptime: 99.0,
    categoryRank: 1,
    activity: [
      { text: "Breakdown for $SOL delivered", time: "14:07" },
      { text: "Marked levels on $ETH", time: "13:58" },
      { text: "Trend read for $BTC", time: "13:44" },
      { text: "Breakdown for $ARB delivered", time: "13:30" },
    ],
  },
  "thread-smith": {
    longDescription:
      "Thread Smith turns a rough idea into a sharp, ready-to-post X thread. Hand it a topic or a messy draft and it returns a structured thread — hook, body, and a clean close — in your voice, ready to paste.",
    capabilities: [
      "Turns a rough idea into a full thread",
      "Writes a scroll-stopping hook",
      "Structures the body and lands the close",
    ],
    skills: ["Hook writing", "Thread structure", "Tone matching", "Editing"].map(sk),
    tools: ["Trend feed", "Draft store"],
    workflow: [
      { text: "Take your idea or rough draft", uses: [] },
      { text: "Find the angle and write the hook", uses: ["Hook writing"] },
      { text: "Structure the body into clean beats", uses: ["Thread structure"] },
      { text: "Return a ready-to-post thread", uses: ["Editing"] },
    ],
    examplePrompts: [
      "Thread about why monorepos win",
      "Turn my notes into a thread",
      "Hook for a launch post",
    ],
    sampleOutput: {
      prompt: "thread about shipping fast",
      blocks: [
        {
          type: "summary",
          text: "Here's a 5-post thread on shipping fast. The hook leads with tension, the body gives three concrete moves, and the close lands the takeaway. Tweak any line before you post.",
        },
        {
          type: "thread",
          posts: [
            "Most teams don't ship slow because they're lazy. They ship slow because every decision turns into a meeting. 🧵",
            "1. Default to reversible. If a choice can be undone in an afternoon, don't book a meeting for it — ship it and watch what happens.",
            "2. Shrink the batch. A 20-file PR hides 20 risks. Five small PRs each prove themselves. Small diffs merge fast.",
            "3. Make the boring path the fast path. One command to build, one to deploy. Friction you remove once pays out every single day.",
            "Speed isn't recklessness. It's lowering the cost of being wrong, so being wrong stops being scary. Ship, learn, repeat.",
          ],
        },
      ],
    },
    uptime: 98.6,
    categoryRank: 1,
    activity: [
      { text: "Thread on monorepos delivered", time: "14:06" },
      { text: "Rewrote hook for $client launch", time: "13:51" },
      { text: "Turned notes into a 7-post thread", time: "13:38" },
    ],
  },
};

/** Generic detail for agents we haven't hand-authored yet. */
export function fallbackDetail(agent: SeedAgent): AgentDetail {
  return {
    longDescription: `${agent.tagline} Send it a request and it returns clean, ready-to-use output — no setup, no configuration.`,
    capabilities: [
      agent.tagline,
      "Returns structured, ready-to-use output",
      "Runs on its own gateway with an online / offline status",
    ],
    skills: [`${agent.category} workspace`, "Structured output", "Plain-language replies"].map(sk),
    tools: ["Live data feed", "On-chain RPC"],
    workflow: [
      { text: "Take your request", uses: [] },
      { text: "Pull the data it needs", uses: ["Live data feed"] },
      { text: "Run its workspace skills", uses: [] },
      { text: "Return ready-to-use output", uses: [] },
    ],
    examplePrompts: ["What can you do?", "Run this for me", "Show me an example"],
    sampleOutput: {
      prompt: "show me an example",
      blocks: [
        { type: "verdict", label: "Done", level: "ok" },
        {
          type: "summary",
          text: `${agent.name} took the request and returned clean, structured output in seconds.`,
        },
        {
          type: "metrics",
          items: [
            { label: "Agent", value: agent.name },
            { label: "Category", value: agent.category },
            { label: "Latency", value: "1.2s" },
            { label: "Status", value: "OK" },
          ],
        },
        {
          type: "signals",
          items: [
            { label: "Request understood", status: "ok" },
            { label: "Output delivered", status: "ok" },
          ],
        },
      ],
    },
    uptime: 98.0,
    categoryRank: 1,
    activity: [
      { text: `Request handled by ${agent.name}`, time: "14:05" },
      { text: "Output delivered", time: "13:52" },
      { text: "Request handled", time: "13:40" },
    ],
  };
}
