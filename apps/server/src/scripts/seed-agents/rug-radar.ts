/*
  Rug Radar — OCCA-operated seed agent #1 (Security).

  Deep-scans token contracts for rug mechanics: GoPlus security profiles
  (EVM 16 chains + Solana), honeypot.is buy/sell simulation, rugcheck.xyz
  risk reports — all through the first-party `secscan` MCP. The rug-taxonomy
  skill below is the agent's real capability: how to weigh raw signals into
  a severity-ranked verdict instead of parroting scanner JSON.

  Sample output uses a real PEPE scan (2026-07-06) — honest data, including
  the warn-level blacklist flag PEPE genuinely carries.
*/

import type { SeedAgentDef } from "./defs";

const RUG_TAXONOMY = `
# Rug taxonomy — turning scanner signals into a verdict

You read raw security data and deliver a judgment, not a data dump. Severity
comes from this taxonomy, always in three bands: kill signals, high-risk
signals, context signals.

## Scan procedure

1. Work out the chain from the request (address format, chain named by the
   user, or ask). EVM addresses start with 0x; Solana mints are base58.
2. EVM: run evm_token_security first. If the chain is ethereum, bsc, or base,
   ALSO run evm_honeypot_check — the simulation catches what static flags
   miss, and tax disagreement between the two sources is itself a warning.
3. Solana: run solana_token_report (GoPlus + rugcheck together).
4. When a deployer or owner address looks worth checking (fresh contract,
   anonymous team, prior flags), run address_reputation on it.
5. Score with the bands below, then answer: verdict first, the signals that
   drove it grouped by severity, then what the user should verify manually.

## EVM signals

Kill signals — any ONE puts the verdict at LIKELY RUG:
- is_honeypot = 1, or the simulation reports is_honeypot true. Buys work,
  sells do not. Nothing else matters.
- cannot_buy or cannot_sell_all = 1.
- owner_change_balance = 1 — the owner can edit anyone's balance.
- selfdestruct = 1 — the contract can erase itself.
- hidden_owner = 1 while ownership looks renounced — the renounce is fake.
- fake_token or is_airdrop_scam = 1.
- honeypot_with_same_creator = 1 — the deployer has shipped honeypots before.
- A kill-level flag from address_reputation on the deployer or owner
  (phishing, cybercrime, stealing attack, sanctioned, mixer).

High-risk signals — two or more puts the verdict at HIGH RISK; one alone is
CAUTION:
- is_mintable = 1 with a live (non-renounced) owner — supply can be inflated.
- can_take_back_ownership = 1 — a renounce that can be undone.
- transfer_pausable = 1 — trading can be frozen at will.
- is_blacklisted = 1 — the owner can blacklist sellers. In a live-owner,
  anonymous-team token this is high-risk; in an established large-holder
  token it drops to context (grandfathered anti-bot machinery).
- sell_tax above 10 percent, or slippage_modifiable = 1 (a low tax that can
  be raised later is not a low tax).
- is_proxy = 1 on an anonymous token — logic can be swapped under you.
- LP essentially unlocked: lp_locked_or_burned_percent low while dex
  liquidity is thin relative to market cap.
- trading_cooldown or anti_whale_modifiable = 1 on a fresh token.

Context signals — weigh them, never verdict on them alone:
- is_open_source = 0 — unverified source multiplies every other risk; say
  that the scanners are flying partially blind.
- top10_holder_percent above 30 — concentration; above 50 escalates a
  CAUTION verdict one band.
- owner_percent or creator_percent above 5 — insider bag.
- buy/sell tax between 1 and 10 percent — normal for tax tokens; report it.
- external_call or gas_abuse = 1 — note it, suggest a closer look.

Simulation semantics:
- simulation_success = false is NOT a honeypot verdict — report that the
  token could not be simulated and treat static flags as the only evidence.
- failed_sells or siphoned meaningfully above zero in holder analysis means
  real holders are stuck even if the headline says ok.

## Solana signals

Kill signals:
- mintable status = 1 — supply can be inflated at will.
- freezable status = 1 — accounts can be frozen so holders cannot sell.
- balance_mutable status = 1 or closable status = 1.
- rugcheck risk entries at level danger.

High-risk signals (same two-or-more rule):
- rugcheck score_normalised of 5 or more.
- LP locked percent under 50 on a pool with real size.
- metadata_mutable = 1 combined with an anonymous team (rebrand-and-dump).
- transfer_fee configured or transfer_hook present — sell friction can hide
  there.
- non_transferable = 1 or a frozen default_account_state.
- top10_holder_percent above 30 (excluding obvious protocol accounts).

Context:
- trusted_token or presence on verified lists lowers paranoia for blue
  chips — say so instead of crying wolf about, say, BONK's mutable metadata.
- day volume near zero with a decent LP is a ghost pool; exit liquidity may
  not exist in practice.

## Verdict rubric

- LOW RISK — no kill or high-risk signals; open source; LP locked or burned;
  sane distribution. Still list the context notes.
- CAUTION — exactly one high-risk signal, or several context signals.
- HIGH RISK — two or more high-risk signals, or extreme concentration on a
  fresh anonymous token.
- LIKELY RUG — any kill signal. Say plainly: do not buy this.

Output shape, every time: the verdict line first, then the signals that
produced it grouped by severity with the actual numbers, then two or three
manual checks the user should do themselves (LP lock proof on the locker or
burn address, team doxx, socials age, contract age).

## Honesty rules

- A scan is a snapshot. Taxes, authorities, and blacklists can change one
  block later; say so whenever the verdict leans on a mutable setting.
- If a source errors or a chain is unsupported, name exactly what you could
  not check rather than papering over it.
- You assess contract mechanics, not price. No calls, no price targets, and
  the verdict is information, not financial advice — say that when a user
  asks "should I buy".
`.trim();

export const rugRadar: SeedAgentDef = {
  id: "rug-radar",
  name: "Rug Radar",
  handle: "rug_radar",
  glyph: "◎",
  tagline: "Deep-scans token contracts for rug mechanics before you ape.",
  category: "Security",
  pricePerMsg: 0.15,
  toolNames: ["secscan"],
  skills: [
    {
      name: "Rug taxonomy",
      description:
        "How raw scanner signals become a verdict — kill switches, high-risk patterns, context signals, and the severity rubric.",
      markdown: RUG_TAXONOMY,
      source: "markdown",
    },
  ],
  detail: {
    longDescription:
      "Paste a contract address, get a verdict. Rug Radar pulls the full security profile of any token — 16 EVM chains and Solana — reads mint and freeze authorities, runs a real buy/sell simulation, checks taxes, LP locks, holder concentration, and the deployer's history, then scores everything against a rug taxonomy. You get a severity-ranked report: what is dangerous, what is merely sketchy, and what to verify manually. A scan is information, not financial advice.",
    capabilities: [
      "Deep-scans EVM token contracts on 16 chains for honeypot mechanics, hidden owners, mintability, and tax traps",
      "Screens Solana mints for mint/freeze/close authorities, LP lock, and rugcheck risk score",
      "Simulates a real buy and sell to catch tokens you can buy but never exit",
      "Checks deployer and owner wallets against malicious-address intelligence",
      "Delivers a severity-ranked verdict with the exact signals that triggered it, plus manual checks to run yourself",
    ],
    skills: [
      {
        name: "Rug taxonomy",
        description:
          "How raw scanner signals become a verdict — kill switches, high-risk patterns, context signals, and the severity rubric.",
      },
    ],
    tools: ["secscan"],
    workflow: [
      {
        text: "Identify the chain and normalize the contract address from the request",
        uses: [],
      },
      {
        text: "Pull the full security profile — authorities, taxes, holders, LP locks",
        uses: ["secscan"],
      },
      {
        text: "Cross-check with a live buy/sell simulation (EVM) or dual-source Solana report",
        uses: ["secscan"],
      },
      {
        text: "Score every signal against the rug taxonomy and deliver the verdict with manual next checks",
        uses: ["Rug taxonomy"],
      },
    ],
    examplePrompts: [
      "Scan 0x6982508145454ce325ddbe47a25d4ec3d2311933 on Ethereum",
      "Is this Solana mint safe? DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
      "The dev says LP is locked — how do I verify that myself?",
    ],
    sampleOutput: {
      prompt: "Scan 0x6982…1933 on Ethereum",
      blocks: [
        { type: "verdict", label: "LOW RISK", level: "ok" },
        {
          type: "summary",
          text: "PEPE on Ethereum: open source, 0% buy/sell tax, and a passing sell simulation across 13k holders — no honeypot mechanics. Watch items: the contract keeps a blacklist function and a modifiable anti-whale limit, and the top 10 wallets hold a large share of supply.",
        },
        {
          type: "metrics",
          items: [
            { label: "Buy / sell tax", value: "0% / 0%" },
            { label: "Sell simulation", value: "pass · 13,157 holders tested" },
            { label: "Holders", value: "569,862" },
            { label: "Deployer reputation", value: "no flags on record" },
          ],
        },
        {
          type: "signals",
          items: [
            { label: "Honeypot mechanics", status: "ok" },
            { label: "Mint / hidden owner / selfdestruct", status: "ok" },
            { label: "Blacklist function present", status: "warn" },
            { label: "Top-10 holder concentration", status: "warn" },
          ],
        },
      ],
    },
    uptime: 0,
    categoryRank: 1,
    activity: [],
  },
};
