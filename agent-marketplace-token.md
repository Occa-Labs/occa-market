# OCCA Open Market — $OCCA Token Design

> Status: **Concept / discussion draft.** Not a build plan yet.
> Companion to [agent-marketplace-blueprint.md](agent-marketplace-blueprint.md). The blueprint covers the marketplace; this covers the token's role in it.
> Decisions marked **LOCKED** are agreed. Decisions marked **OPEN** are still to be decided.
> Last updated: 2026-07-02.

## 1. What $OCCA is (and is not)

$OCCA is the **hold-to-access** token for OCCA Open Market. It is not the currency of the market; it is the membership key.

- **NOT a payment token** (LOCKED). Agents are paid for in **USDC**. You never spend $OCCA to use an agent.
- **NOT a staking token** (LOCKED, initial design). No lock-up mechanic.
- **The organizing rule: the more you hold, the better your experience in the market.** Every utility below is a function of *holdings*, not spend.

The one-line positioning: **USDC pays. $OCCA unlocks.**

## 2. On-chain facts (already live)

$OCCA is **already launched** on pump.fun / Solana. Supply and distribution are therefore closed — decided by the launch, not by us.

| Field | Value |
|---|---|
| Name / symbol | OCCA AI / OCCA |
| Chain / venue | Solana / pump.fun |
| Mint (contract) | `GYSHDDoVtFNdzR72SSkmJcKWFVh9ndhMdYoDKdg8pump` |
| Total supply | 1,000,000,000 (1B), standard pump.fun |

Because supply is 1B, the hold thresholds map to fixed token amounts: **0.1% = 1,000,000 tokens**, 1% = 10M, 3% = 30M, 5% = 50M.

Snapshot (2026-07-02, will drift): price ~$0.00002761, mcap/FDV ~$27.6k, liquidity ~$13.7k. At that price the hold barriers cost roughly Entry $28 / Pro $276 / Elite $828 / Whale $1,380. The percentage gate auto-scales with price — if price 10x's, the Entry barrier becomes ~$280 on its own, no change needed.

**Liquidity watch-out (deferred, not part of utility design):** liquidity ~$13.7k is thin. Upper tiers (Elite/Whale) can't be bought without heavy slippage yet, and the buyback in §5 will swing price hard until the pool deepens. Flagged for later; utility design proceeds regardless.

## 3. The membership line: 0.1%

**0.1% of supply is the universal membership line** (LOCKED). It is the single threshold that gates almost everything:

- Below 0.1% → zero benefits. No trial budget, no fee discount, no reward share, no publishing.
- At/above 0.1% → you are a member, at Entry tier.
- Above 0.1% → higher tiers (see §4).

0.1% works for both **using** agents and **selling** agents (see §6), so it is the one number a participant has to clear to be "in."

## 4. Tier table

Holding more scales up the free budget and the fee discount (LOCKED structure; dollar/percent values are the agreed working numbers).

| Tier | Hold min | Free budget / week | Fee discount | Max holders (token math) |
|---|---|---|---|---|
| **Entry** | 0.1% | 20 messages | 5% | ~1000 |
| **Pro** | 1% | 60 messages | 10% | ~100 |
| **Elite** | 3% | 120 messages | 20% | ~33 |
| **Whale** | 5% | 200 messages | 30% | ~20 |

- Below 0.1% = no access.
- **Budget unit = messages (credits), NOT dollars and NOT tokens** (LOCKED). 1 credit ≈ 1 message/turn to the model. Reset weekly. Messages were chosen because subscription token counts are unreliable and contradictory across sources; message/prompt count is the stabler planning unit.
- Whale (5%) is intentionally exclusive — at most ~20 wallets can ever hold it at once. That is by design, not a bug.

## 5. Value accrual — hybrid buyback

Marketplace fees feed the token through a **hybrid buyback, split at the token level** (LOCKED mechanic; exact percentages OPEN).

Flow:

```
User spends USDC on an agent
      │
      ▼
Platform fee (X%)
      ├─ (1 - Y)%  → ops / OCCA treasury
      └─ Y%        → buyback wallet
                        │
                        ▼
                 swap USDC → $OCCA on a DEX   (100% of Y% becomes buy pressure)
                        │
                        ├─ 60% BURN            → supply down, benefits every holder
                        └─ 40% HOLDER REWARD   → distributed pro-rata, gated to holders ≥ 0.1%
```

Design choices:

- **Token-level split, not USDC-level.** All of Y% becomes buy pressure first; holders receive **$OCCA** (a reward token), not USDC. This keeps it further from a securities-flavored cash dividend.
- **60:40 burn-heavy** keeps the mechanic deflationary-leaning and safer.
- **Reward leg gated to holders ≥ 0.1%** — same membership line as everything else.
- **Cadence: batch per epoch** (e.g. weekly), not per-transaction — cheaper gas, easier to audit. The reward leg needs a per-epoch holder snapshot plus distribution/claim (accepted infra cost).

**Securities / messaging note:** the reward-distribution leg is the most securities-flavored piece of the whole design. Handle §12 messaging guardrails in the blueprint carefully in any public copy. Describe it as a protocol mechanic (buyback, burn, supply reduction), never as a profit promise or investment return.

## 6. Full list of utilities

Demand side (for people who use agents):

1. **Free-trial budget gating** — hold ≥0.1% to receive any free trial budget. (LOCKED)
2. **Tiered budget** — more holdings → bigger weekly message budget (§4). (LOCKED)
3. **Fee discount** — 5/10/20/30% off platform fees by tier; payment stays USDC. (LOCKED)
4. **Early / exclusive access** — early access to new agents, beta features, gated/premium agents. (LOCKED)
5. **Revenue accrual — hybrid buyback** — see §5. (LOCKED mechanic; %s OPEN)

Supply & platform side (for people who sell agents / for the platform):

6. **Creator gating** — to publish/list an agent in the catalog, the creator must hold ≥0.1% $OCCA. Kills spam agents; creators get skin in the game. (LOCKED)
7. **Priority queue** — in the concurrency queue (§7), higher tiers are served first: Whale → Elite → Pro → Entry. Holding = less/no waiting when the backend is busy. (LOCKED)
8. **Holder badge / identity** — tier badge on profile (Entry/Pro/Elite/Whale). Pure identity + crypto-native flex; cheap to build, strong for community/social proof. (LOCKED)

Considered and skipped for now: governance-lite (vote on featured agents), referral boost.

## 7. Backend, capacity & anti-spam

### Backend

The free-trial budget is served by a **Claude Max 5x ($100/mo) subscription driven programmatically via a Claude Code adapter** (headless, subscription auth exposed API-like), **not** the Claude API. (LOCKED, with a caveat.)

Caveat (flagged, accepted by owner): multiplexing one consumer subscription seat across many marketplace users runs against Anthropic's consumer ToS and will get rate-limited/suspended if pushed. The supported path for scale is the API. The subscription model is fine for dev/testing and an initial closed beta.

### Capacity per seat

- Ceiling: ~100–225 messages per rolling 5-hour window (shared across all users on that seat).
- Usable per week: ~4,000 messages; reserve ~1,000 for dev → **~3,000/week to users**.
- One seat ≈ **~100 light active users/week**.
- Scale by **adding seats** (~$100/seat → +100 users); migrate to API only once large.
- Note: published per-5h token figures (~88k tokens) are unreliable and don't reconcile with the message counts. Plan in messages, not tokens.

### Anti-spam (three layers) — LOCKED

1. **Token gate (hold ≥0.1%)** — costs real money to qualify → kills free bot/spam accounts. Also caps the eligible population at ~1000 wallets mathematically.
2. **Hard active-slot cap = 100 × number of seats** (start 100 slots on 1 seat). 1 wallet = 1 slot. Never oversell backend capacity — to admit more users, add a seat first.
3. **Waitlist** — when slots are full, new eligible users go to a waitlist (queued for a freed slot / added seat), not rejected outright.

Full path: buy ≥0.1% $OCCA → eligible → take a slot if available, else waitlist → weekly budget per tier → usage flows through a concurrency queue (≤225 msg/5h/seat, higher tiers prioritized).

## 8. Open items

- Exact **X** (platform fee %) and **Y** (fee share routed to buyback %). Rough placeholders: X ≈ 10–20%, Y ≈ 20–30%.
- Reward-leg **snapshot + distribution/claim** implementation.
- **Adapter** implementation + concurrency-queue design.
- **Liquidity** strategy (deepen the pool before upper tiers + buyback become healthy) — deferred by owner.
- **Launch timing of the marketplace itself** (token is already live; the market is still in build — public messaging is "coming soon").
