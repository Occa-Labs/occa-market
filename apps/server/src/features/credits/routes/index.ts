/*
  Credits routes — the custodial USDC balance behind paid messages.
  GET / serves balance + recent ledger + deposit instructions;
  POST /deposit verifies a submitted USDC transfer and credits it.
  Mounted at /api/credits.
*/

import { Router } from "express";
import type { CreditsSummary, DepositResponse } from "@occa-market/shared";
import { microsToUsd } from "@occa-market/shared";
import { env } from "../../../config/env";
import { asyncHandler } from "../../../lib/async-handler";
import { requireAuth } from "../../../middleware/auth";
import { findUserById } from "../../auth/repositories/users";
import { balanceMicros, listEntries } from "../repositories/ledger";
import { verifyAndCredit } from "../services/deposit";

export const creditsRoutes = Router();

async function summaryFor(userId: string): Promise<CreditsSummary> {
  const [balance, entries] = await Promise.all([
    balanceMicros(userId),
    listEntries(userId),
  ]);
  return {
    balanceUsd: microsToUsd(balance),
    entries: entries.map((e) => ({
      id: e.id,
      kind: e.kind,
      amountUsd: microsToUsd(e.amountMicros),
      agentId: e.agentId,
      txSignature: e.txSignature,
      createdAt: e.createdAt.toISOString(),
    })),
    depositWallet: env.credits.depositWallet,
    usdcMint: env.credits.usdcMint,
  };
}

creditsRoutes.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(await summaryFor(req.user!.userId));
  }),
);

creditsRoutes.post(
  "/deposit",
  requireAuth,
  asyncHandler(async (req, res) => {
    const signature =
      typeof req.body?.signature === "string" ? req.body.signature.trim() : "";
    if (!signature) {
      res.status(400).json({ ok: false, error: "signature is required" });
      return;
    }
    const user = await findUserById(req.user!.userId);
    if (!user) {
      res.status(404).json({ ok: false, error: "user not found" });
      return;
    }
    const result = await verifyAndCredit(user, signature);
    if (!result.ok) {
      res.status(422).json({ ok: false, error: result.error });
      return;
    }
    const body: DepositResponse = {
      ok: true,
      creditedUsd: microsToUsd(result.creditedMicros),
      summary: await summaryFor(user.id),
    };
    res.json(body);
  }),
);
