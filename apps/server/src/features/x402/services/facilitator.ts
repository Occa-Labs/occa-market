/*
  Facilitator client — the only place this server talks x402 to the outside.
  The facilitator owns the blockchain legs: /verify inspects the payment
  transaction against our requirements, /settle co-signs as fee payer and
  submits it. We never touch an RPC on this rail.
*/

import { env } from "../../../config/env";
import {
  X402_VERSION,
  type PaymentPayload,
  type PaymentRequirements,
  type SettleResponse,
  type VerifyResponse,
} from "../domain/types";

const FEE_PAYER_TTL_MS = 10 * 60 * 1000;

let feePayerCache: { value: string; readAt: number } | null = null;

/**
 * The facilitator's signer for our network, from GET /supported. Required in
 * every requirements object (the client builds its transaction around it), so
 * it's cached — a facilitator rotating signers shows up within the TTL.
 */
export async function facilitatorFeePayer(): Promise<string | null> {
  if (feePayerCache && Date.now() - feePayerCache.readAt < FEE_PAYER_TTL_MS) {
    return feePayerCache.value;
  }
  let body: {
    kinds?: { x402Version: number; scheme: string; network: string; extra?: { feePayer?: string } }[];
  };
  try {
    const res = await fetch(`${env.x402.facilitatorUrl}/supported`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    body = (await res.json()) as typeof body;
  } catch {
    return null;
  }
  const kind = (body.kinds ?? []).find(
    (k) =>
      k.x402Version === X402_VERSION &&
      k.scheme === "exact" &&
      k.network === env.x402.network,
  );
  const feePayer = kind?.extra?.feePayer;
  if (!feePayer) return null;
  feePayerCache = { value: feePayer, readAt: Date.now() };
  return feePayer;
}

async function post<T>(path: string, payload: PaymentPayload, requirements: PaymentRequirements, timeoutMs: number): Promise<T | null> {
  try {
    const res = await fetch(`${env.x402.facilitatorUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        x402Version: X402_VERSION,
        paymentPayload: payload,
        paymentRequirements: requirements,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function verifyPayment(
  payload: PaymentPayload,
  requirements: PaymentRequirements,
): Promise<VerifyResponse> {
  const res = await post<VerifyResponse>("/verify", payload, requirements, 15_000);
  return res ?? { isValid: false, invalidReason: "facilitator_unreachable" };
}

export async function settlePayment(
  payload: PaymentPayload,
  requirements: PaymentRequirements,
): Promise<SettleResponse> {
  // Settlement waits for on-chain confirmation — give it room.
  const res = await post<SettleResponse>("/settle", payload, requirements, 60_000);
  return (
    res ?? {
      success: false,
      errorReason: "facilitator_unreachable",
      transaction: "",
      network: env.x402.network,
    }
  );
}

/*
  Duplicate-settlement guard (spec "Duplicate Settlement Mitigation"): the same
  signed transaction submitted twice concurrently could settle-succeed twice at
  the RPC layer while only paying once. An in-process seen-set over the payment
  transaction closes it; entries expire past the blockhash lifetime.
*/
const SEEN_TTL_MS = 120_000;
const seenTransactions = new Map<string, number>();

export function claimTransaction(transaction: string): boolean {
  const now = Date.now();
  for (const [key, at] of seenTransactions) {
    if (now - at > SEEN_TTL_MS) seenTransactions.delete(key);
  }
  if (seenTransactions.has(transaction)) return false;
  seenTransactions.set(transaction, now);
  return true;
}
