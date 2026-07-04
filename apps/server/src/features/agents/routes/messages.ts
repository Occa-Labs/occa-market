/*
  Chat routes. The auth token is the thread identity: history is stored and
  replayed per (user, agent), and the runtime session key is derived from the
  user id — the client sends nothing but the message text.
*/

import { Router } from "express";
import { asyncHandler } from "../../../lib/async-handler";
import { requireAuth } from "../../../middleware/auth";
import { sendMessageBody } from "../domain/schemas";
import { appendExchange, listThread, toChatTurn } from "../repositories/messages";
import { runtime } from "../services/runtime/registry";

export const messagesRoutes = Router();

// Cap how much stored history rides along as model context (fallback runtimes
// only — a gateway agent keeps its own session and gets none).
const CONTEXT_TURNS = 20;

// GET /api/agents/:id/messages — the caller's chat history with this agent.
messagesRoutes.get(
  "/:id/messages",
  requireAuth,
  asyncHandler(async (req, res) => {
    const messages = await listThread(req.params.id, req.user!.userId);
    res.json({ messages });
  }),
);

// POST /api/agents/:id/messages — send a message, get the agent's reply blocks.
messagesRoutes.post(
  "/:id/messages",
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = sendMessageBody.safeParse(req.body);
    if (!parsed.success) {
      const error = parsed.error.issues[0]?.message ?? "invalid body";
      res.status(400).json({ ok: false, error });
      return;
    }

    const agentId = req.params.id;
    const userId = req.user!.userId;
    const { message } = parsed.data;

    const thread = await listThread(agentId, userId);
    const result = await runtime.sendMessage({
      agentId,
      sessionKey: userId,
      message,
      turn: thread.filter((m) => m.role === "agent").length,
      history: thread.slice(-CONTEXT_TURNS).map(toChatTurn),
    });

    if (!result.ok) {
      const status = result.error === "unknown agent" ? 404 : 409;
      res.status(status).json(result);
      return;
    }

    // Persist only completed exchanges — a failed run leaves no history, so a
    // retry doesn't double the user message.
    await appendExchange(agentId, userId, message, result.blocks);

    res.json(result);
  }),
);
