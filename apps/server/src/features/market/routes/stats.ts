/* Market stats route. Mounted at /api/stats. */

import { Router } from "express";
import { asyncHandler } from "../../../lib/async-handler";
import { computeMarketStats } from "../data/stats";

export const statsRouter = Router();

// GET /api/stats — aggregate totals for the landing stat bar.
statsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.json(await computeMarketStats());
  }),
);
