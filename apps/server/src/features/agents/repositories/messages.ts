/*
  Chat history data access — the ONLY place chat_messages is read or written.
  A thread is (userId, agentId); messages come back oldest first, ready to
  render or to replay as model context.
*/

import { and, asc, desc, eq } from "drizzle-orm";
import type { ChatMessage, ChatTurn, OutputBlock } from "@occa-market/shared";
import { db } from "../../../infra/database/client";
import { chatMessages, type ChatMessageRow } from "../../../infra/database/schema";

function toChatMessage(row: ChatMessageRow): ChatMessage {
  return {
    id: row.id,
    role: row.role,
    text: row.text ?? undefined,
    blocks: row.blocks ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listThread(
  agentId: string,
  userId: string,
): Promise<ChatMessage[]> {
  const rows = await db
    .select()
    .from(chatMessages)
    .where(and(eq(chatMessages.agentId, agentId), eq(chatMessages.userId, userId)))
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

/** Persist a completed exchange: the user message and the agent's reply blocks. */
export async function appendExchange(
  agentId: string,
  userId: string,
  userText: string,
  replyBlocks: OutputBlock[],
): Promise<void> {
  await db.insert(chatMessages).values([
    { agentId, userId, role: "user", text: userText },
    { agentId, userId, role: "agent", blocks: replyBlocks },
  ]);
}
