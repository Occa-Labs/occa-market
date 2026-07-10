/*
  Chat data access — the ONLY place chat_sessions and chat_messages are read
  or written. The session is the thread: a user holds many per agent, listed
  most recently active first; messages come back oldest first, ready to render
  or to replay as model context.
*/

import { and, asc, desc, eq, sql } from "drizzle-orm";
import type {
  ChatMessage,
  ChatSession,
  ChatTurn,
  OutputBlock,
} from "@occa-market/shared";
import { db } from "../../../infra/database/client";
import {
  agents,
  chatMessages,
  chatSessions,
  messageRatings,
  type AgentRow,
  type ChatMessageRow,
  type ChatSessionRow,
} from "../../../infra/database/schema";

function toChatSession(row: ChatSessionRow): ChatSession {
  return {
    id: row.id,
    title: row.title,
    shareId: row.shareId ?? undefined,
    createdAt: row.createdAt.toISOString(),
    lastMessageAt: row.lastMessageAt.toISOString(),
  };
}

function toChatMessage(row: ChatMessageRow): ChatMessage {
  return {
    id: row.id,
    role: row.role,
    text: row.text ?? undefined,
    blocks: row.blocks ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listSessions(
  agentId: string,
  userId: string,
): Promise<ChatSession[]> {
  const rows = await db
    .select()
    .from(chatSessions)
    .where(and(eq(chatSessions.agentId, agentId), eq(chatSessions.userId, userId)))
    .orderBy(desc(chatSessions.lastMessageAt));
  return rows.map(toChatSession);
}

/** A session only if it exists AND belongs to this user and agent — else null. */
export async function getOwnedSession(
  sessionId: string,
  agentId: string,
  userId: string,
): Promise<ChatSession | null> {
  const [row] = await db
    .select()
    .from(chatSessions)
    .where(
      and(
        eq(chatSessions.id, sessionId),
        eq(chatSessions.agentId, agentId),
        eq(chatSessions.userId, userId),
      ),
    )
    .limit(1);
  return row ? toChatSession(row) : null;
}

/** `id` is caller-supplied: it doubles as the runtime continuity key, which
    must exist before the row does (the row is only written on a successful
    first exchange, so a failed run leaves no empty session behind). */
export async function createSession(
  id: string,
  agentId: string,
  userId: string,
  title: string,
): Promise<ChatSession> {
  const [row] = await db
    .insert(chatSessions)
    .values({ id, agentId, userId, title })
    .returning();
  return toChatSession(row);
}

export async function deleteSession(sessionId: string): Promise<void> {
  await db.delete(chatSessions).where(eq(chatSessions.id, sessionId));
}

/** Set (or clear, with null) a session's public share handle. */
export async function setSessionShare(
  sessionId: string,
  shareId: string | null,
): Promise<void> {
  await db
    .update(chatSessions)
    .set({ shareId })
    .where(eq(chatSessions.id, sessionId));
}

/** A shared session with its agent, by public share handle — else null. */
export async function getSharedSession(
  shareId: string,
): Promise<{ session: ChatSession; agent: AgentRow } | null> {
  const [row] = await db
    .select({ session: chatSessions, agent: agents })
    .from(chatSessions)
    .innerJoin(agents, eq(agents.id, chatSessions.agentId))
    .where(eq(chatSessions.shareId, shareId))
    .limit(1);
  return row ? { session: toChatSession(row.session), agent: row.agent } : null;
}

export async function listSessionMessages(
  sessionId: string,
): Promise<ChatMessage[]> {
  const rows = await db
    .select({ message: chatMessages, rating: messageRatings.value })
    .from(chatMessages)
    .leftJoin(messageRatings, eq(messageRatings.messageId, chatMessages.id))
    .where(eq(chatMessages.sessionId, sessionId))
    // An exchange is inserted as one statement, so both rows share a now()
    // timestamp — role desc ("user" > "agent") keeps the question first.
    .orderBy(asc(chatMessages.createdAt), desc(chatMessages.role));
  return rows.map((r) => ({
    ...toChatMessage(r.message),
    rating: r.rating === 1 || r.rating === -1 ? r.rating : undefined,
  }));
}

/** A stored turn as plain text, for model context (agent blocks → joined summaries). */
export function toChatTurn(m: ChatMessage): ChatTurn {
  return {
    role: m.role,
    text:
      m.role === "user"
        ? (m.text ?? "")
        : (m.blocks ?? [])
            .map((b) => (b.type === "summary" ? b.text : ""))
            .filter(Boolean)
            .join("\n\n"),
  };
}

/*
  Reputation is earned, never hand-set: every successful run counts 1, every
  thumbs counts ±5, floored at zero. Recomputed from source data after
  anything that moves it (a run, a rating) — no drift.
*/
export async function recomputeReputation(agentId: string): Promise<void> {
  await db.execute(sql`
    update agents set reputation = greatest(
      0,
      uses + 5 * coalesce(
        (select sum(value) from message_ratings where agent_id = ${agentId}), 0
      )
    ) where id = ${agentId}
  `);
}

/**
 * Count a completed run — the volume half of reputation. Chat runs arrive via
 * appendExchange; the x402 rail calls this directly (no chat session there).
 */
export async function countRun(agentId: string): Promise<void> {
  await db
    .update(agents)
    .set({ uses: sql`${agents.uses} + 1` })
    .where(eq(agents.id, agentId));
  await recomputeReputation(agentId);
}

/**
 * Persist a completed exchange, bump the session's activity timestamp, and
 * count the run. Returns the agent reply's id (the handle for rating it).
 */
export async function appendExchange(
  agentId: string,
  sessionId: string,
  userText: string,
  replyBlocks: OutputBlock[],
): Promise<string> {
  const inserted = await db
    .insert(chatMessages)
    .values([
      { sessionId, role: "user", text: userText },
      { sessionId, role: "agent", blocks: replyBlocks },
    ])
    .returning({ id: chatMessages.id, role: chatMessages.role });
  await db
    .update(chatSessions)
    .set({ lastMessageAt: new Date() })
    .where(eq(chatSessions.id, sessionId));
  await countRun(agentId);
  return inserted.find((m) => m.role === "agent")!.id;
}

/**
 * Set (+1/−1) or clear (0) the caller's thumbs on one of their agent replies,
 * then fold it into the agent's reputation. The message must belong to the
 * given session (already ownership-checked by the route).
 */
export async function rateMessage(
  agentId: string,
  sessionId: string,
  messageId: string,
  userId: string,
  value: 1 | -1 | 0,
): Promise<boolean> {
  const [message] = await db
    .select({ id: chatMessages.id, role: chatMessages.role })
    .from(chatMessages)
    .where(and(eq(chatMessages.id, messageId), eq(chatMessages.sessionId, sessionId)))
    .limit(1);
  if (!message || message.role !== "agent") return false;

  if (value === 0) {
    await db.delete(messageRatings).where(eq(messageRatings.messageId, messageId));
  } else {
    await db
      .insert(messageRatings)
      .values({ messageId, agentId, userId, value })
      .onConflictDoUpdate({
        target: messageRatings.messageId,
        set: { value, createdAt: new Date() },
      });
  }
  await recomputeReputation(agentId);
  return true;
}
