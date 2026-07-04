/*
  Chat data access — the ONLY place chat_sessions and chat_messages are read
  or written. The session is the thread: a user holds many per agent, listed
  most recently active first; messages come back oldest first, ready to render
  or to replay as model context.
*/

import { and, asc, desc, eq } from "drizzle-orm";
import type {
  ChatMessage,
  ChatSession,
  ChatTurn,
  OutputBlock,
} from "@occa-market/shared";
import { db } from "../../../infra/database/client";
import {
  chatMessages,
  chatSessions,
  type ChatMessageRow,
  type ChatSessionRow,
} from "../../../infra/database/schema";

function toChatSession(row: ChatSessionRow): ChatSession {
  return {
    id: row.id,
    title: row.title,
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

export async function listSessionMessages(
  sessionId: string,
): Promise<ChatMessage[]> {
  const rows = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.sessionId, sessionId))
    // An exchange is inserted as one statement, so both rows share a now()
    // timestamp — role desc ("user" > "agent") keeps the question first.
    .orderBy(asc(chatMessages.createdAt), desc(chatMessages.role));
  return rows.map(toChatMessage);
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

/** Persist a completed exchange and bump the session's activity timestamp. */
export async function appendExchange(
  sessionId: string,
  userText: string,
  replyBlocks: OutputBlock[],
): Promise<void> {
  await db.insert(chatMessages).values([
    { sessionId, role: "user", text: userText },
    { sessionId, role: "agent", blocks: replyBlocks },
  ]);
  await db
    .update(chatSessions)
    .set({ lastMessageAt: new Date() })
    .where(eq(chatSessions.id, sessionId));
}
