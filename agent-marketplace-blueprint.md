# OCCA Open Market — Marketplace Blueprint

> Status: **Concept / discussion draft.** Not a build plan yet.
> Name: **OCCA Open Market** (LOCKED). Subdomain: `market.occaai.com`. A part of OCCA, not a standalone brand — "Open" signals permissionless/public, "Market" the agent marketplace.
> Decisions marked **LOCKED** are agreed. Decisions marked **PROPOSED** are my recommendation, pending confirmation.

## 1. Why this exists

The full "company" product (task boards, newsroom, hierarchy, treasury) is heavy. Its scope is wide, the learning curve is steep, and only serious operators stick with it. It is the right long-term bet, but it is a poor front door.

OCCA Open Market is the **light, fun front door**. A crypto-native user can show up, use a bot in seconds, or park an idle gateway and earn, without understanding any of the company machinery.

Goals, in priority order:

1. Give crypto community something fun and instantly usable, so OCCA gets attention.
2. Create a visible on-chain economy (volume, earnings, leaderboards) that makes a good token narrative.
3. Drive real, non-forced utility and demand sinks for the OCCA token.

Explicit non-goal: replacing the company product. OCCA Open Market is a wider, shallower entry point that can funnel the serious users into the company product later.

## 2. Core concept

A public catalog of **ready-made agents**. Each agent has a persona, a skill set, and tools — already configured. A visitor browses, picks one, and uses it. No setup.

What is sold is the **agent's work and output**, not raw model access. This is deliberate (see §9, ToS safety).

The difference from the company product: no task board, no hierarchy, no newsroom. One agent, one clear function, used directly. Light, instant, shareable.

This is the consumer/crypto-fun layer sitting on top of primitives OCCA already has.

### 2.1 Agent and gateway are bound (LOCKED for MVP)

There are two distinct entities, with different roles:

- **Gateway / adapter** = the runtime. The "power source." Under BYORT it runs on the *provider's own* subscription, so the provider pays the inference cost and owns the ToS relationship.
- **Agent** = the workspace. Persona, skills, tools, workflow, memory. The "product."

For MVP these are **bound per provider**: one provider brings one gateway *and* the agent that runs on it. They travel together, and they die together. There is no pooling, no scheduling an agent across other people's gateways, no failover.

Why bound and not poolable: BYORT makes pooling near-impossible. An agent running on provider A's gateway consumes A's tokens; you cannot migrate a live session to provider B mid-conversation without changing who pays and losing context/memory. Binding is also what keeps us ToS-safe — we sell the agent's *work*, not raw transferable compute.

Consequence: a provider is **not** "someone with idle compute." A provider is "someone who builds and hosts one agent." They contribute both. Barrier is kept low via templates (fork a ready-made agent, tweak persona/skills, publish) rather than building from scratch.

MVP behavior on failure: gateway down → agent shows **offline** in the catalog, cannot be started. Dies mid-session → session drops, unused credit is refunded. Uptime feeds reputation, so flaky providers rank lower. Failover / adapter migration is explicitly an **upgrade for later**, out of scope for v1 (see §11).

## 3. Actors

- **Provider** *(MVP)* — a user who connects an idle gateway and publishes an agent to the public catalog. Earns from usage.
- **Consumer (human)** *(MVP)* — a user who browses the catalog and uses an agent via the UI. Pays in USDC via a credit balance.
- **Consumer (machine/dev)** *(later)* — a bot or app that calls a published agent programmatically via API. Pays per request via x402. Deferred: demand is thin and it adds integration surface.
- **Protocol** *(later)* — OCCA. Takes a fee, runs settlement, runs buyback-burn, distributes staking rewards.

### 3.1 MVP scope (LOCKED)

MVP has **two players only: provider and human consumer.** The single goal is to prove the core loop works: someone hosts an agent, someone else uses it and pays USDC, the provider gets paid.

Deferred to post-MVP (do not build at the start):

- Machine/dev consumer and the x402 rail.
- Protocol fee, buyback-burn, staking rewards — all the OCCA token mechanics from §7.

Honest flag: deferring the fee + burn means **OCCA does nothing in MVP** — it is functionally a USDC agent marketplace until token mechanics land. That is an acceptable first step, but the token must enter in the very next iteration, or there is no OCCA story. Prove users first, layer the token second.

## 4. What is reused vs new

Reused (already shipped or in-tree):

- Idle gateway / deploy-origin model (user-origin idle gateways).
- BYORT adapters (OpenClaw, Claude Code, Codex).
- On-chain settlement, disbursement, periodic anchor (daily anchor pattern).
- Reputation via trace anchor / provenance.

New to build:

- Public agent catalog: browse + use without understanding OCCA internals.
- Per-request metering and a USDC credit-balance system.
- x402 payment rail for programmatic consumption.
- Fee split + settlement to providers.
- Leaderboards (top agents, top providers, total volume).
- Token mechanics: stake-to-list, stake-for-fee-share, buyback-burn.

## 5. The economic loop

```
Provider parks idle gateway  ──▶  publishes agent to catalog
                                        │
Consumer browses, picks agent  ◀────────┘
        │
        ├─ human: deposit USDC once → credit balance → each message debits balance
        └─ machine: pay per request via x402 (USDC under the hood)
        │
        ▼
   Payment splits:
        ├─ Provider take      (PROPOSED 90%)
        └─ Protocol fee       (PROPOSED 10%)
                  ├─ buyback-burn OCCA   (PROPOSED 60% of fee)
                  └─ OCCA staker rewards (PROPOSED 40% of fee)
        │
        ▼
   Provider settled on-chain periodically (reuse daily anchor + disbursement).
   Leaderboards update. Volume is public and on-chain.
```

The narrative: people use bots and pay stable USDC; the fees recycle into buyback-burn and staker rewards; OCCA appreciates because it absorbs marketplace activity, not because anyone is forced to pay with it.

### 5.1 MVP loop (LOCKED)

The MVP loop is the short version of the above — no token mechanics yet:

```
Provider hosts agent  ──▶  Consumer deposits USDC once → credit balance
                                        │
                          each use debits the balance
                          (metering unit — per-message / per-token /
                           per-task — DEFERRED, see §10.1)
                                        │
                                        ▼
                          Protocol fee: 0.5%   (LOCKED)
                          Provider take: 99.5%
                                        │
                                        ▼
                          Provider settled on-chain periodically.
                          Fee accrues to treasury; burn/staking wired later.
```

Why a fee from day one even though burn is off: it is much easier to set a fee on day one than to raise it from 0% later (people resent a previously-free thing suddenly being charged). The 0.5% collected just pools in the treasury until the burn/staking mechanics are ready, then gets routed in.

## 6. Payment architecture — LOCKED

**OCCA is never the unit of payment.** Volatility makes it a bad medium of exchange. Payment is always USDC underneath.

Two rails, same USDC underneath, different doors:

- **Credit model (humans, via UI).** Deposit USDC once, get a balance, each message debits it. No per-message wallet popup. Smooth.
- **x402 (machines/devs, via API).** Native HTTP 402 per-request payment in USDC. Purpose-built for per-request micropayments, and a strong narrative (Coinbase-backed, rising).

Per-message on-chain micro-transactions are avoided for the human path; metering is off-chain against the credit balance, with periodic on-chain settlement to providers.

Honest caveat: real third-party USDC agent-payment demand is currently thin and largely wash. Do not assume organic volume at launch. This is exactly why §8 (seeding + leaderboard + earn-on-idle narrative) matters: manufacture activity and story first.

### 6.1 Free welcome credit (LOCKED)

New users get a small **protocol-funded welcome credit** so they can try the marketplace before depositing any USDC. They spend it like normal credit; the **provider still gets paid** — out of a protocol trial-subsidy pool, not the provider's pocket. Once the free credit runs out, the user tops up with their own USDC.

This removes first-touch friction, which matters for the fun/acquisition goal.

Abuse guard (required, not optional): free credit gets farmed via sybil (many accounts draining the trial pool). So the welcome credit must be **capped per identity** and gated lightly (one grant per wallet/identity). Do not make it generous.

## 7. OCCA token role — LOCKED

OCCA is the **value-capture layer**, never the payment unit. Three utilities plus a sink:

- **Gate.** Hold OCCA to unlock features, higher earning tier, or access to premium agents.
- **Reward.** Stake OCCA to earn a share of protocol fees.
- **Upgrade.** Stake OCCA to list an agent, boost ranking, or raise limits. Also acts as a spam filter.
- **Buyback-burn.** A portion of every fee buys OCCA on the market and burns it, so marketplace activity flows into price and supply.

Net: users who only want to use bots never touch OCCA. Users who want upside hold/stake it. Both feed the same volume.

## 8. Go-to-market mechanics

These exist to manufacture the visible economy before organic demand arrives.

- **Seed first.** OCCA team publishes a handful of fun, crypto-flavored agents so the catalog and leaderboard are not empty on day one. (LOCKED) An empty marketplace is a fatal first impression; open public publishing only after the catalog already has life.
- **Leaderboards.** Top-earning agents, top providers, total daily volume — all public and on-chain. Screenshot-able bullish material.
- **Earn-on-idle narrative.** "Park your idle gateway, wake up to earnings." Simple yield story for crypto audiences.
- **Flex loop.** Owning a high-ranking agent is a status object; sharing it pulls in more consumers.

## 9. Trust, abuse, and ToS safety

- **ToS safety.** Sell agent work/output, not raw model access. Reselling raw Claude/OpenAI subscription capacity likely violates provider ToS and is a time bomb. The product framing must stay on "configured agent that produces something," never "cheap inference."
- **Reputation.** Use trace anchor / provenance so consumers can judge an agent before paying. Gate low-reputation providers.
- **Wash trading.** Crypto users will wash to farm rewards and climb leaderboards. Stake-to-list raises the cost; fee design must not make self-dealing profitable (a provider paying themselves should net-lose on fees). Needs explicit modeling before any reward goes live.
- **Quality / refunds.** Consumer-grade expectations (bad output, refunds) are new territory the company product never faced. See refund stance below.

### 9.1 MVP refund stance (LOCKED)

- **Technical failure** (agent offline, session drops mid-conversation) → unused credit **auto-refunded**. No request needed.
- **"Bad output"** (user doesn't like the result) → **no refund.** Quality is subjective and trivially gamed for free usage.

These two work *because of* the free welcome credit (§6.1): a user tries an agent for free first, so paying real USDC afterward is an informed choice, not a blind gamble. The free credit is the "try before you buy," which is exactly what makes a no-refund-on-quality stance fair.

## 10. Open decisions

1. **Pricing model.** DEFERRED — discuss later. Three candidates: **pay-per-message**, **pay-per-token**, **pay-per-task**. Not blocking MVP framing; the credit-debit mechanic is the same regardless of which metering unit wins.
2. **Fee split.** PROPOSED: **90% provider / 10% protocol**, and of that fee **60% buyback-burn / 40% staker rewards** (burn-heavy early for the deflation narrative, shift toward stakers as staking grows). Confirm or adjust.
3. **Seed vs open.** LOCKED: **seed a few agents first**, then open public publishing.
4. **Name.** LOCKED: **OCCA Open Market**, deployed at `market.occaai.com`.
5. **Anti-wash model.** Open. Must be modeled before staking rewards go live.

## 11. Out of scope for v1

- Task boards, hierarchy, newsroom, multi-agent companies (that is the company product).
- Mainnet token mechanics (start where the rest of the on-chain layer is — devnet).
- Full dispute resolution / escrow. v1 gets a minimal refund stance only.

## 12. Public messaging guardrails

Internal mechanics that must stay out of public posts, tweets, and marketing. This is the kitchen, not the storefront. Check this table before publishing anything.

| Do not disclose | Why | Safe to say instead |
|---|---|---|
| ToS angle (sell work, not inference, to dodge subscription-resale rules) | Exposes the legal fragility | "Agents produce real work/output" |
| Providers run on their own subscription to host the agent | The core fragility of the model | "Providers host their own agents" |
| Agent dies when its gateway dies, no failover | Reliability weakness | Nothing. Or "agents have an online/offline status" |
| OCCA does nothing in MVP, token mechanics deferred | Kills the token narrative | "Token is part of the ecosystem" (no timeline) |
| USDC agent-payment demand is thin and largely wash | Admits the market is weak | Nothing |
| Fee 0.5%, provider 99.5%, target split 90/10 and 60/40 | Half-baked internal economics | Announce only when the mechanic ships |
| Free credit is protocol-subsidized, plus sybil concern | Opens an abuse surface | "New users get free credit to try" |
| Pricing undecided, anti-wash unbuilt, much still deferred | Signals an unfinished product | A clean teaser only |
| Framing "the company product is heavy, audience narrow" | Self-deprecates the main product | Nothing on this |
| Faking organic liveliness while actually seeded | Destroys trust | Seed agents *openly disclosed as OCCA-operated* are fine (matches the public Agent Labor Market docs) |

Note on the last row: seeding itself is not secret. OCCA's published docs already disclose OCCA-operated seed agents transparently. What stays private is pretending activity is organic when it is seeded.

Roadmap continuity: OCCA Open Market is a **separate, new concept** from the existing public docs (Template Marketplace, Agent Labor Market are company/B2B). Its internals and design differ and do not have to follow those (e.g. the Labor Market's fixed-pricing / anti-metering stance does not bind this). The only thread that must stay consistent publicly is the high-level "OCCA has marketplaces." Do not frame Open Market as if it *is* the old Labor Market.

## Appendix — seed ideas folded in

From earlier scratch notes (since deleted), these belong to this blueprint:

- Public agent that visitors can chat with and give tasks to; agent economy as a first-class OS surface.
- Per-agent gateway, per-agent adapter, per-agent wallet.
- Agent reputation / track record on-chain.
- BYORT as the provider-side primitive.
- Direct report to owner via Telegram or other channel.
- Agent token launcher (later-stage idea, not v1).
