/*
  $OCCA holder tiers — the hold-to-access membership layer (token doc §3–§6).

  USDC pays, $OCCA unlocks: tiers gate the free weekly message budget, the
  fee discount, and publishing. Thresholds are percentages of total supply so
  they survive any price move; with a 1B supply 0.1% = 1,000,000 tokens.
  These numbers are LOCKED in agent-marketplace-token.md — change them there
  first, then here.
*/

export type HolderTier = "none" | "entry" | "pro" | "elite" | "whale";

export type TierSpec = {
  tier: Exclude<HolderTier, "none">;
  label: string;
  /** Minimum holding as a fraction of total supply (0.001 = 0.1%). */
  minSupplyPct: number;
  /** Free messages per week across all agents. */
  weeklyBudget: number;
  /** Platform-fee discount applied to paid usage (0.05 = 5%). */
  feeDiscount: number;
};

/** Descending, so the first spec a balance clears is the holder's tier. */
export const TIER_SPECS: readonly TierSpec[] = [
  { tier: "whale", label: "Whale", minSupplyPct: 0.05, weeklyBudget: 200, feeDiscount: 0.3 },
  { tier: "elite", label: "Elite", minSupplyPct: 0.03, weeklyBudget: 120, feeDiscount: 0.2 },
  { tier: "pro", label: "Pro", minSupplyPct: 0.01, weeklyBudget: 60, feeDiscount: 0.1 },
  { tier: "entry", label: "Entry", minSupplyPct: 0.001, weeklyBudget: 20, feeDiscount: 0.05 },
] as const;

/** The universal membership line (token doc §3): below this, zero benefits. */
export const MEMBERSHIP_PCT = 0.001;

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
  /** Holding as a fraction of total supply (0.001 = 0.1%). */
  supplyPct: number;
  /** Tokens still missing to reach the membership line (0 once a member). */
  toMembership: number;
  /** Free messages per week for this tier (0 for none). */
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
