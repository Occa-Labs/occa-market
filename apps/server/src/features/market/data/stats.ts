/*
  Market-level aggregate stats for the landing-page stat bar. Everything is
  computed from live data: catalog for online/total/uses, the credit ledger
  for settled USDC volume (zero until the paid rail activates — shown as
  real, never faked), daily_anchors for the on-chain footprint.
*/

import { sql } from "drizzle-orm";
import type { MarketStats } from "@occa-market/shared";
import { db } from "../../../infra/database/client";
import { creditLedger, dailyAnchors, x402Charges } from "../../../infra/database/schema";
import { listAgents } from "../../agents/repositories/agents";

export async function computeMarketStats(): Promise<MarketStats> {
  const [agents, [{ chargedMicros }], [{ x402Micros }], [{ anchoredDays }]] =
    await Promise.all([
      listAgents(),
      db
        .select({
          chargedMicros: sql<string>`coalesce(sum(abs(${creditLedger.amountMicros})), 0)`,
        })
        .from(creditLedger)
        .where(sql`${creditLedger.kind} = 'charge'`),
      // Machine-rail volume: only delivered charges — a settled payment whose
      // run failed is a refund candidate, not volume.
      db
        .select({
          x402Micros: sql<string>`coalesce(sum(${x402Charges.priceMicros} + ${x402Charges.feeMicros}), 0)`,
        })
        .from(x402Charges)
        .where(sql`${x402Charges.delivered} = true`),
      db.select({ anchoredDays: sql<number>`count(*)::int` }).from(dailyAnchors),
    ]);

  return {
    agentsOnline: agents.filter((a) => a.status === "online").length,
    totalAgents: agents.length,
    totalUses: agents.reduce((sum, a) => sum + a.uses, 0),
    volumeUsd: Math.round((Number(chargedMicros) + Number(x402Micros)) / 1_000_000),
    anchoredDays,
  };
}
