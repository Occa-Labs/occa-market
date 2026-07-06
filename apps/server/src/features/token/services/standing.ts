/*
  Holder standing + the two gates it powers (token doc §4/§6).

  Standing is the assembled TokenStanding wire shape: holdings snapshot →
  tier → daily + weekly budgets vs the usage ledger. Non-holders get the free
  trial budgets (§3, revised 2026-07-05) instead of zero. The gates are the
  enforcement half: chat consumes budget (daily first, then weekly),
  publishing requires membership. Both bypass for dev wallets and no-op
  entirely while TOKEN_GATE_ENABLED=0 — standing still computes so the UI
  meter works before the gate flips on.
*/

import {
  MEMBERSHIP_PCT,
  TRIAL_DAILY_BUDGET,
  TRIAL_WEEKLY_BUDGET,
  publishMinTokens,
  tierForSupplyPct,
  tierSpec,
  type TokenStanding,
} from "@occa-market/shared";
import { env } from "../../../config/env";
import type { UserRow } from "../../../infra/database/schema";
import { findUserById } from "../../auth/repositories/users";
import { dayResetAt, weekResetAt } from "../domain/week";
import { countUsedThisWeek, countUsedToday } from "../repositories/usage";
import { getHoldings } from "./holdings";

function isDevWallet(user: UserRow): boolean {
  return Boolean(
    user.walletAddress && env.token.devWallets.includes(user.walletAddress),
  );
}

export async function standingForUser(
  user: UserRow,
  opts: { force?: boolean } = {},
): Promise<TokenStanding> {
  const { balance, checkedAt } = await getHoldings(user, opts);
  const supplyPct = balance / env.token.totalSupply;
  const tier = tierForSupplyPct(supplyPct);
  const spec = tierSpec(tier);
  const trial = !spec;
  const dailyBudget = spec?.dailyBudget ?? TRIAL_DAILY_BUDGET;
  const weeklyBudget = spec?.weeklyBudget ?? TRIAL_WEEKLY_BUDGET;
  const [usedToday, usedThisWeek] = await Promise.all([
    countUsedToday(user.id),
    countUsedThisWeek(user.id),
  ]);
  const unmetered = isDevWallet(user);
  const publishMin = publishMinTokens(env.token.totalSupply);

  return {
    tier,
    walletAddress: user.walletAddress,
    balance,
    supplyPct,
    toMembership: Math.max(0, MEMBERSHIP_PCT * env.token.totalSupply - balance),
    trial,
    publishMin,
    toPublish: Math.max(0, publishMin - balance),
    canPublish: !env.token.gateEnabled || unmetered || balance >= publishMin,
    dailyBudget,
    usedToday,
    remainingToday: Math.max(0, dailyBudget - usedToday),
    dayResetAt: dayResetAt().toISOString(),
    weeklyBudget,
    usedThisWeek,
    remaining: Math.max(0, weeklyBudget - usedThisWeek),
    feeDiscount: spec?.feeDiscount ?? 0,
    weekResetAt: weekResetAt().toISOString(),
    checkedAt: checkedAt?.toISOString() ?? null,
    unmetered,
    enforced: env.token.gateEnabled,
  };
}

export async function getStanding(
  userId: string,
  opts: { force?: boolean } = {},
): Promise<TokenStanding | null> {
  const user = await findUserById(userId);
  return user ? standingForUser(user, opts) : null;
}

/*
  Gate results carry the standing so a blocked client can render the right
  card (which limit bound, trial vs holder) without a second round-trip.
*/
export type GateResult =
  | { allowed: true; metered: boolean }
  | { allowed: false; code: "hold_required" | "budget_exhausted"; standing: TokenStanding };

/**
 * Chat gate: daily allowance first, then the weekly budget. Non-holders run
 * on the trial budgets, so `hold_required` never fires here — running dry
 * answers `budget_exhausted` and the standing says which limit bound.
 * `metered: true` means the caller must record one budget_usage row once the
 * run succeeds — usage is only charged for delivered replies, matching the
 * auto-refund stance.
 */
export async function checkMessageGate(userId: string): Promise<GateResult> {
  if (!env.token.gateEnabled) return { allowed: true, metered: true };

  const user = await findUserById(userId);
  if (!user) return { allowed: true, metered: true };
  if (isDevWallet(user)) return { allowed: true, metered: false };

  const standing = await standingForUser(user);
  if (standing.remainingToday <= 0 || standing.remaining <= 0) {
    return { allowed: false, code: "budget_exhausted", standing };
  }
  return { allowed: true, metered: true };
}

/**
 * Publish gate (NEW builds): listing a fresh agent requires the publisher bar
 * (PUBLISH_MIN_PCT = 1,000,000 $OCCA on a 1B supply) — heavier than the chat
 * membership line, so a builder doesn't configure a whole agent only to be
 * turned away. canPublish already folds in enforcement and the dev bypass.
 */
export async function checkPublishGate(userId: string): Promise<GateResult> {
  if (!env.token.gateEnabled) return { allowed: true, metered: false };

  const user = await findUserById(userId);
  if (!user) return { allowed: true, metered: false };

  const standing = await standingForUser(user);
  if (!standing.canPublish) {
    return { allowed: false, code: "hold_required", standing };
  }
  return { allowed: true, metered: false };
}

/**
 * Revise gate (EDITS to an existing listing): stays at the original
 * membership line, NOT the heavier publish bar — revising what you already
 * own shouldn't demand the full builder stake, only that you still hold
 * (dumping every token shouldn't keep the keys).
 */
export async function checkReviseGate(userId: string): Promise<GateResult> {
  if (!env.token.gateEnabled) return { allowed: true, metered: false };

  const user = await findUserById(userId);
  if (!user) return { allowed: true, metered: false };
  if (isDevWallet(user)) return { allowed: true, metered: false };

  const standing = await standingForUser(user);
  if (standing.tier === "none") {
    return { allowed: false, code: "hold_required", standing };
  }
  return { allowed: true, metered: false };
}
