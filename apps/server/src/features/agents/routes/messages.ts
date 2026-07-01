/*
  Chat route. Parse → validate (zod) → run through the runtime → respond.
  Body: { message, sessionKey?, turn?, history? }.
*/

import { Router } from "express";
import { sendMessageBody } from "../domain/schemas";
import { runtime } from "../services/runtime/registry";

export const messagesRoutes = Router();

// POST /api/agents/:id/messages — send a message, get the agent's reply blocks.
messagesRoutes.post("/:id/messages", async (req, res) => {
  const parsed = sendMessageBody.safeParse(req.body);
  if (!parsed.success) {
    const error = parsed.error.issues[0]?.message ?? "invalid body";
    res.status(400).json({ ok: false, error });
    return;
  }

  const { message, sessionKey, turn, history } = parsed.data;
  const result = await runtime.sendMessage({
    agentId: req.params.id,
    sessionKey: sessionKey ?? "anon",
    message,
    turn: turn ?? 0,
    history,
  });

  if (!result.ok) {
    const status = result.error === "unknown agent" ? 404 : 409;
    res.status(status).json(result);
    return;
  }

  res.json(result);
});
