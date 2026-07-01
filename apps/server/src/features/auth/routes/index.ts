/*
  Auth routes. POST /privy exchanges a Privy token for our JWT; GET /me returns
  the current user from that JWT. Mounted at /api/auth.
*/

import { Router } from "express";
import { asyncHandler } from "../../../lib/async-handler";
import { requireAuth } from "../../../middleware/auth";
import { toAuthUser } from "../domain/dtos";
import { privyLoginBody } from "../domain/schemas";
import { findUserById } from "../repositories/users";
import { loginWithPrivy } from "../services/privy-login";

export const authRoutes = Router();

authRoutes.post(
  "/privy",
  asyncHandler(async (req, res) => {
    const parsed = privyLoginBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "invalid body" });
      return;
    }

    const result = await loginWithPrivy(parsed.data.accessToken);
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }

    res.json(result.data);
  }),
);

authRoutes.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const row = await findUserById(req.user!.userId);
    if (!row) {
      res.status(404).json({ error: "user not found" });
      return;
    }
    res.json({ user: toAuthUser(row) });
  }),
);
