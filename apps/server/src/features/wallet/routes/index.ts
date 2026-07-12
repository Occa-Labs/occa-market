/*
  Wallet route — a signed-in provider's balances + settlement earnings.
*/

import { Router } from "express";
import type { WalletHistoryResponse } from "@occa-market/shared";
import { asyncHandler } from "../../../lib/async-handler";
import { requireAuth } from "../../../middleware/auth";
import { listWalletActivity } from "../repositories/activity";
import { walletSummary } from "../services/wallet";

export const walletRoutes = Router();

// GET /api/wallet — spendable USDC + earnings across the caller's agents.
walletRoutes.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(await walletSummary(req.user!.userId));
  }),
);

// GET /api/wallet/history — the caller's recent payments-in + claims-out.
walletRoutes.get(
  "/history",
  requireAuth,
  asyncHandler(async (req, res) => {
    const activity = await listWalletActivity(req.user!.userId);
    const body: WalletHistoryResponse = { activity };
    res.json(body);
  }),
);
