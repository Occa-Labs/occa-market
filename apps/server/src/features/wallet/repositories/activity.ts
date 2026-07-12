/*
  Wallet activity — a provider's settlement transactions: x402 payments their
  agents received (money in) and claims they cranked (money out). Both mirror
  on-chain state; the chain stays authoritative.
*/

import { desc, eq } from "drizzle-orm";
import { microsToUsd, type WalletActivityEntry } from "@occa-market/shared";
import { db } from "../../../infra/database/client";
import { agents, settlementClaims, x402Charges } from "../../../infra/database/schema";
import { settlementCluster } from "../../../infra/onchain/settlement";

export async function insertClaimRecord(input: {
  agentId: string;
  providerUserId: string;
  providerMicros: number;
  feeMicros: number;
  txSignature: string;
}): Promise<void> {
  await db.insert(settlementClaims).values(input);
}

/**
 * The provider's recent activity, newest first: payments in (the price the
 * agent earned) and claims out (the take that reached their wallet). Merged
 * from both tables and capped — this is a glance, not a full ledger export.
 */
export async function listWalletActivity(
  providerUserId: string,
  limit = 25,
): Promise<WalletActivityEntry[]> {
  const cluster = settlementCluster();

  const [payments, claims] = await Promise.all([
    db
      .select({
        agentId: x402Charges.agentId,
        agentName: agents.name,
        priceMicros: x402Charges.priceMicros,
        txSignature: x402Charges.txSignature,
        createdAt: x402Charges.createdAt,
      })
      .from(x402Charges)
      .leftJoin(agents, eq(agents.id, x402Charges.agentId))
      .where(eq(x402Charges.providerUserId, providerUserId))
      .orderBy(desc(x402Charges.createdAt))
      .limit(limit),
    db
      .select({
        agentId: settlementClaims.agentId,
        agentName: agents.name,
        providerMicros: settlementClaims.providerMicros,
        txSignature: settlementClaims.txSignature,
        createdAt: settlementClaims.createdAt,
      })
      .from(settlementClaims)
      .leftJoin(agents, eq(agents.id, settlementClaims.agentId))
      .where(eq(settlementClaims.providerUserId, providerUserId))
      .orderBy(desc(settlementClaims.createdAt))
      .limit(limit),
  ]);

  const entries: WalletActivityEntry[] = [
    ...payments.map((p) => ({
      kind: "payment" as const,
      agentId: p.agentId,
      agentName: p.agentName ?? p.agentId,
      amountUsd: microsToUsd(p.priceMicros ?? 0),
      txSig: p.txSignature,
      cluster,
      at: p.createdAt.toISOString(),
    })),
    ...claims.map((c) => ({
      kind: "claim" as const,
      agentId: c.agentId,
      agentName: c.agentName ?? c.agentId,
      amountUsd: microsToUsd(c.providerMicros),
      txSig: c.txSignature,
      cluster,
      at: c.createdAt.toISOString(),
    })),
  ];

  entries.sort((a, b) => (a.at < b.at ? 1 : -1));
  return entries.slice(0, limit);
}
