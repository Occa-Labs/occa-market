/*
  x402 machine rail — pay-per-request agent access for bots and dev clients,
  no account needed (blueprint §6). Speaks x402 v2 over HTTP: a request
  without payment gets 402 + PAYMENT-REQUIRED; a request with a
  PAYMENT-SIGNATURE header is verified and settled through the facilitator,
  then the agent runs.

  Order matters: settlement happens BEFORE the run. A Solana payment
  transaction dies with its blockhash (~60–90s) while tool-heavy runs pass
  2 minutes, so run-then-settle would systematically deliver long runs unpaid.
  The cost of settling first is owning the failure case: a settled payment
  whose run failed is recorded undelivered and refunded manually.
*/

import { Router } from "express";
import { z } from "zod";
import { feeMicros, usdToMicros } from "@occa-market/shared";
import { env } from "../../../config/env";
import { asyncHandler } from "../../../lib/async-handler";
import { getAgentRow } from "../../agents/repositories/agents";
import { countRun } from "../../agents/repositories/messages";
import { runtime } from "../../agents/services/runtime/registry";
import { vaultPayTo } from "../../../infra/onchain/settlement";
import { insertSettledCharge, markChargeOutcome } from "../repositories/charges";
import {
  claimTransaction,
  facilitatorFeePayer,
  settlePayment,
  verifyPayment,
} from "../services/facilitator";
import {
  X402_VERSION,
  type PaymentPayload,
  type PaymentRequired,
  type PaymentRequirements,
  type SettleResponse,
} from "../domain/types";

export const x402Routes = Router();

const b64 = (value: unknown) =>
  Buffer.from(JSON.stringify(value), "utf8").toString("base64");

const sendBody = z.object({
  message: z.string().trim().min(1, "message is required"),
  // Client-chosen continuity key; conversation state is scoped to the payer,
  // so one buyer can never resume another's session.
  sessionKey: z
    .string()
    .regex(/^[a-zA-Z0-9_-]{1,64}$/, "sessionKey must be 1-64 url-safe chars")
    .optional(),
});

// The payment payload only needs shape-checking here — the facilitator does
// the cryptographic and on-chain validation against OUR requirements.
const paymentPayloadShape = z.object({
  x402Version: z.number(),
  accepted: z.object({}).passthrough(),
  payload: z.object({ transaction: z.string().min(1) }),
});

function resourceUrl(req: { protocol: string; headers: Record<string, unknown>; originalUrl: string; get(name: string): string | undefined }): string {
  const proto = (req.headers["x-forwarded-proto"] as string) ?? req.protocol;
  return `${proto}://${req.get("host")}${req.originalUrl}`;
}

// POST /api/x402/agents/:id/messages — one paid turn with an agent.
x402Routes.post(
  "/agents/:id/messages",
  asyncHandler(async (req, res) => {
    if (!env.x402.enabled || !env.credits.depositWallet) {
      res.status(503).json({ ok: false, error: "x402 payments are not enabled on this server" });
      return;
    }

    const parsed = sendBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: parsed.error.issues[0]?.message ?? "invalid body" });
      return;
    }

    const row = await getAgentRow(req.params.id);
    if (!row) {
      res.status(404).json({ ok: false, error: "unknown agent" });
      return;
    }

    // Machine price: listed price + the flat 10% protocol fee on top. Holder
    // tiers don't reach this rail — there's no account to hold standing.
    const priceMicros = usdToMicros(row.pricePerMsg);
    const fee = feeMicros(priceMicros, 0);
    const totalMicros = priceMicros + fee;

    const feePayer = await facilitatorFeePayer();
    if (!feePayer) {
      res.status(503).json({
        ok: false,
        error: "payment facilitator is unavailable for this network — try again shortly",
      });
      return;
    }

    // Where the payment lands. With the settlement program configured and the
    // agent registered on-chain, pay into its non-custodial vault (the split
    // happens on-chain at claim); otherwise the treasury wallet (phase 1). The
    // charge row records the price/fee attribution either way.
    const payTo = vaultPayTo(row.onchain?.agentPubkey) ?? env.credits.depositWallet;

    const requirements: PaymentRequirements = {
      scheme: "exact",
      network: env.x402.network,
      amount: String(totalMicros),
      asset: env.credits.usdcMint,
      payTo,
      maxTimeoutSeconds: 60,
      extra: { feePayer },
    };

    const paymentRequired = (error: string, status = 402) => {
      const body: PaymentRequired = {
        x402Version: X402_VERSION,
        error,
        resource: {
          url: resourceUrl(req),
          description: `One message to ${row.name} on the OCCA Open Market`,
          mimeType: "application/json",
        },
        accepts: [requirements],
      };
      res.status(status).setHeader("PAYMENT-REQUIRED", b64(body)).json(body);
    };

    const header = req.get("PAYMENT-SIGNATURE");
    if (!header && totalMicros > 0) {
      paymentRequired("PAYMENT-SIGNATURE header is required");
      return;
    }

    // Free agent (price 0): no payment leg, still a real run.
    let settlement: SettleResponse | null = null;
    let chargeId: string | null = null;
    let payer = "";

    if (totalMicros > 0) {
      let payload: PaymentPayload;
      try {
        payload = JSON.parse(Buffer.from(header!, "base64").toString("utf8"));
      } catch {
        paymentRequired("PAYMENT-SIGNATURE is not base64-encoded JSON");
        return;
      }
      const shape = paymentPayloadShape.safeParse(payload);
      if (!shape.success || payload.x402Version !== X402_VERSION) {
        paymentRequired("payment payload is malformed or the wrong x402 version");
        return;
      }

      const verdict = await verifyPayment(payload, requirements);
      if (!verdict.isValid) {
        paymentRequired(verdict.invalidReason ?? "payment verification failed");
        return;
      }

      // One settlement per signed transaction — a concurrent replay of the
      // same payment loses here instead of double-serving.
      if (!claimTransaction(payload.payload.transaction)) {
        paymentRequired("this payment is already being settled");
        return;
      }

      settlement = await settlePayment(payload, requirements);
      if (!settlement.success || !settlement.transaction) {
        paymentRequired(settlement.errorReason ?? "payment settlement failed");
        return;
      }
      payer = settlement.payer ?? verdict.payer ?? "";

      chargeId = await insertSettledCharge({
        agentId: row.id,
        providerUserId: row.ownerUserId,
        payer,
        priceMicros,
        feeMicros: fee,
        txSignature: settlement.transaction,
      });
      if (!chargeId) {
        // Unique tx_signature: this settled payment was already recorded and
        // served (a replay past the in-memory guard, e.g. after a restart).
        paymentRequired("this payment was already used");
        return;
      }
      res.setHeader("PAYMENT-RESPONSE", b64(settlement));
    }

    // Money moved — from here every path must answer with the settlement
    // receipt, and an undelivered outcome must land on the charge row.
    const { message, sessionKey } = parsed.data;
    const continuity = payer && sessionKey ? `x402-${payer}-${sessionKey}` : crypto.randomUUID();

    const result = await runtime.sendMessage({
      agentId: row.id,
      sessionKey: continuity,
      message,
      turn: 0,
      history: [],
    });

    const payment = settlement
      ? { transaction: settlement.transaction, network: settlement.network, payer }
      : undefined;

    if (!result.ok) {
      if (chargeId) {
        await markChargeOutcome(chargeId, { delivered: false, errorCode: result.error });
      }
      res.status(502).json({
        ok: false,
        error: result.error,
        ...(result.reason ? { reason: result.reason } : {}),
        // The payment DID settle. The receipt is the buyer's refund claim.
        ...(payment ? { payment } : {}),
      });
      return;
    }

    if (chargeId) await markChargeOutcome(chargeId, { delivered: true });
    await countRun(row.id);

    res.json({
      ok: true,
      blocks: result.blocks,
      ...(sessionKey ? { sessionKey } : {}),
      ...(payment ? { payment } : {}),
    });
  }),
);
