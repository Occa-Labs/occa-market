/*
  x402 charge access — the only place x402_charges is read or written. A row
  exists only after the payment settled on-chain; `delivered` records whether
  the buyer got their reply, so undelivered rows are the refund work-list.
*/

import { eq } from "drizzle-orm";
import { db } from "../../../infra/database/client";
import { x402Charges } from "../../../infra/database/schema";

export async function insertSettledCharge(input: {
  agentId: string;
  providerUserId: string | null;
  payer: string;
  priceMicros: number;
  feeMicros: number;
  txSignature: string;
}): Promise<string | null> {
  try {
    const [row] = await db
      .insert(x402Charges)
      .values({ ...input, delivered: false })
      .returning({ id: x402Charges.id });
    return row?.id ?? null;
  } catch {
    // Unique tx_signature — this settled transaction was already recorded.
    return null;
  }
}

export async function markChargeOutcome(
  id: string,
  outcome: { delivered: true } | { delivered: false; errorCode: string },
): Promise<void> {
  await db
    .update(x402Charges)
    .set(
      outcome.delivered
        ? { delivered: true }
        : { delivered: false, errorCode: outcome.errorCode },
    )
    .where(eq(x402Charges.id, id));
}
