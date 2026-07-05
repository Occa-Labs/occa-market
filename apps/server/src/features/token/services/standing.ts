/*
  Holder standing + the two gates it powers (token doc §4/§6).

  Standing is the assembled TokenStanding wire shape: holdings snapshot →
  tier → weekly budget vs the usage ledger. The gates are the enforcement
  half: chat consumes budget, publishing requires membership. Both bypass for
  dev wallets and no-op entirely while TOKEN_GATE_ENABLED=0 — standing still
  computes so the UI meter works before the gate flips on.
*/

import {
  MEMBERSHIP_PCT,
  tierForSupplyPct,
  tierSpec,
  type TokenStanding,
} from "@occa-market/shared";
import { env } from "../../../config/env";
import type { UserRow } from "../../../infra/database/schema";
import { findUserById } from "../../auth/repositories/users";
import { weekResetAt } from "../domain/week";
import { countUsedThisWeek } from "../repositories/usage";
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
  const weeklyBudget = spec?.weeklyBudget ?? 0;
  const usedThisWeek = await countUsedThisWeek(user.id);

  return {
    tier,
    walletAddress: user.walletAddress,
    balance,
    supplyPct,
    toMembership: Math.max(0, MEMBERSHIP_PCT * env.token.totalSupply - balance),
    weeklyBudget,
    usedThisWeek,
    remaining: Math.max(0, weeklyBudget - usedThisWeek),
    feeDiscount: spec?.feeDiscount ?? 0,
    weekResetAt: weekResetAt().toISOString(),
    checkedAt: checkedAt?.toISOString() ?? null,
    unmetered: isDevWallet(user),
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
  card (hold vs exhausted) without a second round-trip.
*/
export type GateResult =
  | { allowed: true; metered: boolean }
  | { allowed: false; code: "hold_required" | "budget_exhausted"; standing: TokenStanding };

/**
 * Chat gate: membership line, then weekly budget. `metered: true` means the
 * caller must record one budget_usage row once the run succeeds — usage is
 * only charged for delivered replies, matching the auto-refund stance.
 */
export async function checkMessageGate(userId: string): Promise<GateResult> {
  if (!env.token.gateEnabled) return { allowed: true, metered: true };

  const user = await findUserById(userId);
  if (!user) return { allowed: true, metered: true };
  if (isDevWallet(user)) return { allowed: true, metered: false };

  const standing = await standingForUser(user);
  if (standing.tier === "none") {
    return { allowed: false, code: "hold_required", standing };
  }
  if (standing.remaining <= 0) {
    return { allowed: false, code: "budget_exhausted", standing };
  }
  return { allowed: true, metered: true };
}

/** Publish gate (token doc §6.6): listing an agent requires membership. */
export async function checkPublishGate(userId: string): Promise<GateResult> {
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
