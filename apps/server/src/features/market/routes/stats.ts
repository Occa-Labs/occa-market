/* Market stats route. Mounted at /api/stats. */

import { Router } from "express";
import { computeMarketStats } from "../data/stats";

export const statsRouter = Router();

// GET /api/stats — aggregate totals for the landing stat bar.
statsRouter.get("/", async (_req, res) => {
  res.json(await computeMarketStats());
});
