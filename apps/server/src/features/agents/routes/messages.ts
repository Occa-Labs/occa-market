/*
  Chat routes. The auth token is the identity; the session is the thread.
  Sending without a sessionId starts a fresh session (titled from the message)
  and the response carries the session back. The runtime continuity key is the
  session id, so separate sessions never share model context.
*/

import { Router } from "express";
import { asyncHandler } from "../../../lib/async-handler";
import { requireAuth } from "../../../middleware/auth";
import { rateMessageBody, sendMessageBody } from "../domain/schemas";
import {
  appendExchange,
  createSession,
  deleteSession,
  getOwnedSession,
  listSessionMessages,
  listSessions,
  rateMessage,
  setSessionShare,
  toChatTurn,
} from "../repositories/messages";
import { runtime } from "../services/runtime/registry";

export const messagesRoutes = Router();

// Cap how much stored history rides along as model context (fallback runtimes
// only — a gateway agent keeps its own session and gets none).
const CONTEXT_TURNS = 20;

// A session title is its first user message, cut to list length.
function sessionTitle(message: string): string {
  const line = message.replace(/\s+/g, " ").trim();
  return line.length > 64 ? `${line.slice(0, 63)}…` : line;
}

// GET /api/agents/:id/sessions — the caller's sessions with this agent.
messagesRoutes.get(
  "/:id/sessions",
  requireAuth,
  asyncHandler(async (req, res) => {
    const sessions = await listSessions(req.params.id, req.user!.userId);
    res.json({ sessions });
  }),
);

// GET /api/agents/:id/sessions/:sessionId/messages — one session's history.
messagesRoutes.get(
  "/:id/sessions/:sessionId/messages",
  requireAuth,
  asyncHandler(async (req, res) => {
    const session = await getOwnedSession(
      req.params.sessionId,
      req.params.id,
      req.user!.userId,
    );
    if (!session) {
      res.status(404).json({ error: "unknown session" });
      return;
    }
    const messages = await listSessionMessages(session.id);
    res.json({ messages });
  }),
);

// DELETE /api/agents/:id/sessions/:sessionId — drop a session and its messages.
messagesRoutes.delete(
  "/:id/sessions/:sessionId",
  requireAuth,
  asyncHandler(async (req, res) => {
    const session = await getOwnedSession(
      req.params.sessionId,
      req.params.id,
      req.user!.userId,
    );
    if (!session) {
      res.status(404).json({ error: "unknown session" });
      return;
    }
    await deleteSession(session.id);
    res.json({ ok: true });
  }),
);

// POST /api/agents/:id/sessions/:sessionId/share — make a session public.
// Minting is idempotent: an already-shared session keeps its handle.
messagesRoutes.post(
  "/:id/sessions/:sessionId/share",
  requireAuth,
  asyncHandler(async (req, res) => {
    const session = await getOwnedSession(
      req.params.sessionId,
      req.params.id,
      req.user!.userId,
    );
    if (!session) {
      res.status(404).json({ error: "unknown session" });
      return;
    }
    const shareId = session.shareId ?? crypto.randomUUID();
    if (!session.shareId) await setSessionShare(session.id, shareId);
    res.json({ shareId });
  }),
);

// DELETE /api/agents/:id/sessions/:sessionId/share — make it private again.
// The handle is discarded, so re-sharing mints a fresh link.
messagesRoutes.delete(
  "/:id/sessions/:sessionId/share",
  requireAuth,
  asyncHandler(async (req, res) => {
    const session = await getOwnedSession(
      req.params.sessionId,
      req.params.id,
      req.user!.userId,
    );
    if (!session) {
      res.status(404).json({ error: "unknown session" });
      return;
    }
    await setSessionShare(session.id, null);
    res.json({ ok: true });
  }),
);

// POST /api/agents/:id/messages — send a message, get the agent's reply blocks.
// Streams NDJSON: `{t:"event", event}` lines while the agent works (the chat's
// live activity timeline), then one `{t:"result", result}` line. Pre-run
// failures (validation, unknown session) respond as plain JSON with a status.
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
    const { message, sessionId } = parsed.data;

    const existing = sessionId
      ? await getOwnedSession(sessionId, agentId, userId)
      : null;
    if (sessionId && !existing) {
      res.status(404).json({ ok: false, error: "unknown session" });
      return;
    }

    // From here on the run is live — switch to the NDJSON stream. Errors now
    // ride in the result line, not the HTTP status.
    res.setHeader("Content-Type", "application/x-ndjson");
    res.setHeader("Cache-Control", "no-cache");
    res.flushHeaders();
    const writeLine = (obj: unknown) => res.write(`${JSON.stringify(obj)}\n`);

    // A fresh session's id is minted up front — the runtime continuity key —
    // but the row is only written after a successful exchange.
    const threadId = existing?.id ?? crypto.randomUUID();
    const thread = existing ? await listSessionMessages(existing.id) : [];
    const result = await runtime.sendMessage(
      {
        agentId,
        sessionKey: threadId,
        message,
        turn: thread.filter((m) => m.role === "agent").length,
        history: thread.slice(-CONTEXT_TURNS).map(toChatTurn),
      },
      (event) => writeLine({ t: "event", event }),
    );

    if (!result.ok) {
      writeLine({ t: "result", result });
      res.end();
      return;
    }

    // Persist only completed exchanges — a failed run leaves no history (and
    // no empty session), so a retry doesn't double the user message.
    const session =
      existing ??
      (await createSession(threadId, agentId, userId, sessionTitle(message)));
    const messageId = await appendExchange(
      agentId,
      session.id,
      message,
      result.blocks,
    );

    writeLine({ t: "result", result: { ...result, session, messageId } });
    res.end();
  }),
);

// PUT /api/agents/:id/sessions/:sessionId/messages/:messageId/rating —
// thumbs on an agent reply (+1 / −1, 0 clears). Feeds the agent's reputation.
messagesRoutes.put(
  "/:id/sessions/:sessionId/messages/:messageId/rating",
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = rateMessageBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: "value must be 1, -1 or 0" });
      return;
    }
    const session = await getOwnedSession(
      req.params.sessionId,
      req.params.id,
      req.user!.userId,
    );
    if (!session) {
      res.status(404).json({ ok: false, error: "unknown session" });
      return;
    }
    const ok = await rateMessage(
      req.params.id,
      session.id,
      req.params.messageId,
      req.user!.userId,
      parsed.data.value,
    );
    if (!ok) {
      res.status(404).json({ ok: false, error: "unknown message" });
      return;
    }
    res.json({ ok: true });
  }),
);
