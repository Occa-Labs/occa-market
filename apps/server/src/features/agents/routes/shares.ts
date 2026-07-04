/*
  Public share route — the ONE unauthenticated window into chat data. Looks up
  a session by its share handle and returns a read-only projection: the
  agent's public shape, the session title, and the messages. No user identity,
  no runtime internals.
*/

import { Router } from "express";
import { asyncHandler } from "../../../lib/async-handler";
import { toMarketAgent } from "../domain/dtos";
import { getSharedSession, listSessionMessages } from "../repositories/messages";

export const sharesRoutes = Router();

// GET /api/shares/:shareId — a publicly shared session, or 404.
sharesRoutes.get(
  "/:shareId",
  asyncHandler(async (req, res) => {
    const shared = await getSharedSession(req.params.shareId);
    if (!shared) {
      res.status(404).json({ error: "unknown share" });
      return;
    }
    const messages = await listSessionMessages(shared.session.id);
    res.json({
      agent: toMarketAgent(shared.agent),
      title: shared.session.title,
      createdAt: shared.session.createdAt,
      messages,
    });
  }),
);
