/*
  Holder standing routes. GET /standing serves the cached snapshot (TTL);
  POST /standing/refresh forces a chain re-read — the "I just bought" button.
  Mounted at /api/token.
*/

import { Router } from "express";
import { asyncHandler } from "../../../lib/async-handler";
import { requireAuth } from "../../../middleware/auth";
import { getStanding } from "../services/standing";

export const tokenRoutes = Router();

tokenRoutes.get(
  "/standing",
  requireAuth,
  asyncHandler(async (req, res) => {
    const standing = await getStanding(req.user!.userId);
    if (!standing) {
      res.status(404).json({ error: "user not found" });
      return;
    }
    res.json({ standing });
  }),
);

tokenRoutes.post(
  "/standing/refresh",
  requireAuth,
  asyncHandler(async (req, res) => {
    const standing = await getStanding(req.user!.userId, { force: true });
    if (!standing) {
      res.status(404).json({ error: "user not found" });
      return;
    }
    res.json({ standing });
  }),
);
