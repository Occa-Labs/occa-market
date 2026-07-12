/* Market-wide run history route. Mounted at /api/history. Public. */

import { Router } from "express";
import type { HistoryResponse } from "@occa-market/shared";
import { asyncHandler } from "../../../lib/async-handler";
import { onchainCluster } from "../../../infra/onchain/client";
import { env } from "../../../config/env";
import { computeHistoryStats, listRunHistory } from "../data/history";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

// The x402 network is a CAIP-2 chain id; map it to a Solana explorer cluster
// so settlement-tx links resolve. Unknown ids fall back to mainnet-beta.
function x402ExplorerCluster(): string {
  const genesis = env.x402.network.split(":")[1];
  if (genesis === "EtWTRABZaYq6iMfeYKouRu166VU2xqa1") return "devnet";
  return "mainnet-beta";
}

export const historyRouter = Router();

// GET /api/history?before=<iso>&limit=<n> — per-run feed, newest first.
historyRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const beforeRaw = typeof req.query.before === "string" ? req.query.before : null;
    const before = beforeRaw ? new Date(beforeRaw) : null;
    if (before && Number.isNaN(before.getTime())) {
      res.status(400).json({ error: "before must be an ISO timestamp" });
      return;
    }
    const limitRaw = Number(req.query.limit);
    const limit = Number.isInteger(limitRaw)
      ? Math.min(Math.max(limitRaw, 1), MAX_LIMIT)
      : DEFAULT_LIMIT;

    const [{ runs, nextBefore }, stats] = await Promise.all([
      listRunHistory(before, limit),
      computeHistoryStats(),
    ]);
    const body: HistoryResponse = {
      runs,
      stats,
      cluster: onchainCluster(),
      x402Cluster: x402ExplorerCluster(),
      nextBefore,
    };
    res.json(body);
  }),
);
