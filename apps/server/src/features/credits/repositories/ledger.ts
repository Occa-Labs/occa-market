/*
  Credit ledger access — the only place credit_ledger is read or written.
  Balance is SUM(amount_micros); the ledger is append-only (no updates, no
  deletes) so every cent is auditable back to a deposit tx or a message.
*/

import { desc, eq, sum } from "drizzle-orm";
import { db } from "../../../infra/database/client";
import { creditLedger, type CreditLedgerRow } from "../../../infra/database/schema";

export async function balanceMicros(userId: string): Promise<number> {
  const [row] = await db
    .select({ value: sum(creditLedger.amountMicros) })
    .from(creditLedger)
    .where(eq(creditLedger.userId, userId));
  return Number(row?.value ?? 0);
}

export async function listEntries(
  userId: string,
  limit = 25,
): Promise<CreditLedgerRow[]> {
  return db
    .select()
    .from(creditLedger)
    .where(eq(creditLedger.userId, userId))
    .orderBy(desc(creditLedger.createdAt))
    .limit(limit);
}

export async function hasDeposit(txSignature: string): Promise<boolean> {
  const [row] = await db
    .select({ id: creditLedger.id })
    .from(creditLedger)
    .where(eq(creditLedger.txSignature, txSignature))
    .limit(1);
  return Boolean(row);
}

export async function insertDeposit(input: {
  userId: string;
  amountMicros: number;
  txSignature: string;
}): Promise<void> {
  await db.insert(creditLedger).values({
    userId: input.userId,
    kind: "deposit",
    amountMicros: input.amountMicros,
    txSignature: input.txSignature,
  });
}

export async function insertCharge(input: {
  userId: string;
  agentId: string;
  providerUserId: string | null;
  messageId: string;
  priceMicros: number;
  feeMicros: number;
}): Promise<void> {
  await db.insert(creditLedger).values({
    userId: input.userId,
    kind: "charge",
    amountMicros: -(input.priceMicros + input.feeMicros),
    agentId: input.agentId,
    providerUserId: input.providerUserId,
    messageId: input.messageId,
    priceMicros: input.priceMicros,
    feeMicros: input.feeMicros,
  });
}
