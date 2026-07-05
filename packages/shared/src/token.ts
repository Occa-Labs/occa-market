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
