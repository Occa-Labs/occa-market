/*
  $OCCA holder tiers — the hold-to-access membership layer (token doc §3–§6).

  USDC pays, $OCCA unlocks: tiers gate the free weekly message budget, the
  fee discount, and publishing. Thresholds are percentages of total supply so
  they survive any price move; with a 1B supply 0.05% = 500,000 tokens.
  These numbers are LOCKED in agent-marketplace-token.md — change them there
  first, then here.
*/

export type HolderTier = "none" | "entry" | "pro" | "elite" | "whale";

export type TierSpec = {
  tier: Exclude<HolderTier, "none">;
  label: string;
  /** Minimum holding as a fraction of total supply (0.0005 = 0.05%). */
  minSupplyPct: number;
  /** Free messages per day across all agents — paces the weekly budget. */
  dailyBudget: number;
  /** Free messages per week across all agents — the real quota. */
  weeklyBudget: number;
  /** Platform-fee discount applied to paid usage (0.05 = 5%). */
  feeDiscount: number;
};

/** Descending, so the first spec a balance clears is the holder's tier. */
export const TIER_SPECS: readonly TierSpec[] = [
  { tier: "whale", label: "Whale", minSupplyPct: 0.025, dailyBudget: 50, weeklyBudget: 250, feeDiscount: 0.3 },
  { tier: "elite", label: "Elite", minSupplyPct: 0.015, dailyBudget: 30, weeklyBudget: 150, feeDiscount: 0.2 },
  { tier: "pro", label: "Pro", minSupplyPct: 0.005, dailyBudget: 20, weeklyBudget: 100, feeDiscount: 0.1 },
  { tier: "entry", label: "Entry", minSupplyPct: 0.0005, dailyBudget: 10, weeklyBudget: 40, feeDiscount: 0.05 },
] as const;

/** The universal membership line (token doc §3): below this, trial only. */
export const MEMBERSHIP_PCT = 0.0005;

/*
  Free trial for wallets below the membership line (token doc §3, revised
  2026-07-05): a marketing taste of the product — capped daily AND weekly so
  a free account can never out-message a paying Entry holder.
*/
export const TRIAL_DAILY_BUDGET = 3;
export const TRIAL_WEEKLY_BUDGET = 10;

/*
  The publisher bar — listing an agent requires a heavier hold than the
  membership line that governs chat budgets. 0.1% of supply = 1,000,000 on a
  1B supply: above Entry (0.05%), below Pro (0.5%). This is a publish-specific
  threshold, NOT a tier line. agent-marketplace-token.md §6.6 still states the
  old membership bar — update the doc when this ships.
*/
export const PUBLISH_MIN_PCT = 0.001;

/** Minimum $OCCA (in tokens) to publish, for a given total supply. */
export function publishMinTokens(totalSupply: number): number {
  return PUBLISH_MIN_PCT * totalSupply;
}

/*
  Paid usage (blueprint §5, revised 2026-07-06): the platform fee rides ON TOP
  of the listed price and is paid by the consumer — the provider always
  receives their listed price in full. Holder tiers discount the fee, never
  the provider's cut. Money math runs in integer micro-USD (USDC's 6
  decimals) so ledger rows never see floats.
*/
export const PLATFORM_FEE_PCT = 0.1;

/** Fee in micro-USD for a price at a holder's fee discount. */
export function feeMicros(priceMicros: number, feeDiscount: number): number {
  return Math.round(priceMicros * PLATFORM_FEE_PCT * (1 - feeDiscount));
}

/** What a paid message costs the consumer, in micro-USD (price + fee). */
export function paidCostMicros(priceMicros: number, feeDiscount: number): number {
  return priceMicros + feeMicros(priceMicros, feeDiscount);
}

export function usdToMicros(usd: number): number {
  return Math.round(usd * 1_000_000);
}

export function microsToUsd(micros: number): number {
  return micros / 1_000_000;
}

export function tierSpec(tier: HolderTier): TierSpec | null {
  return TIER_SPECS.find((s) => s.tier === tier) ?? null;
}

/** Tier for a holding expressed as a fraction of total supply. */
export function tierForSupplyPct(pct: number): HolderTier {
  return TIER_SPECS.find((s) => pct >= s.minSupplyPct)?.tier ?? "none";
}

/*
  The holder's live standing — one wire shape for badge, chat meter, and
  dashboard. Balances are UI amounts (already divided by mint decimals).
*/
export type TokenStanding = {
  tier: HolderTier;
  /** Wallet the balance was read from; null = no wallet linked yet. */
  walletAddress: string | null;
  /** $OCCA held, in tokens. */
  balance: number;
  /** Holding as a fraction of total supply (0.0005 = 0.05%). */
  supplyPct: number;
  /** Tokens still missing to reach the membership line (0 once a member). */
  toMembership: number;
  /** Below the membership line — the budgets below are the free trial. */
  trial: boolean;
  /** The publisher bar in tokens (heavier than membership) — for display. */
  publishMin: number;
  /** Tokens still missing to reach the publisher bar (0 once cleared). */
  toPublish: number;
  /**
   * May this holder publish an agent? Folds in enforcement and dev bypass:
   * true when the gate is off, the wallet is unmetered, or the balance clears
   * the publisher bar. The build flow gates on exactly this.
   */
  canPublish: boolean;
  /** Free messages per day (trial or tier). */
  dailyBudget: number;
  /** Messages consumed since today started (00:00 UTC). */
  usedToday: number;
  /** Messages left today (never negative). */
  remainingToday: number;
  /** ISO timestamp when the daily allowance resets (next 00:00 UTC). */
  dayResetAt: string;
  /** Free messages per week (trial or tier). */
  weeklyBudget: number;
  /** Messages consumed since the week started. */
  usedThisWeek: number;
  /** Messages left this week (never negative). */
  remaining: number;
  /** Platform-fee discount for this tier (0.05 = 5%). */
  feeDiscount: number;
  /** ISO timestamp when the weekly budget resets (next Monday 00:00 UTC). */
  weekResetAt: string;
  /** ISO timestamp of the balance snapshot backing this standing. */
  checkedAt: string | null;
  /** Dev/admin wallet — unmetered, gates bypassed. */
  unmetered: boolean;
  /**
   * Whether the server enforces the hold + budget gates (TOKEN_GATE_ENABLED).
   * False = standing is informational; chat and publishing stay open.
   */
  enforced: boolean;
};
