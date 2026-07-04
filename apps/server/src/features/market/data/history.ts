/*
  Market-wide run history — every agent reply across the catalog, newest
  first, joined with its buyer thumbs and its day's on-chain anchor status.
  Metadata only: message content never leaves the session it belongs to.
*/

import { and, desc, eq, lt, sql } from "drizzle-orm";
import type { HistoryStats, RunHistoryEntry } from "@occa-market/shared";
import { db } from "../../../infra/database/client";
import {
  agents,
  chatMessages,
  chatSessions,
  dailyAnchors,
  messageRatings,
} from "../../../infra/database/schema";

// Inlined 86400 (no bind params) — must stay structurally identical between
// the select and the join condition.
const dayExpr = sql<number>`(floor(extract(epoch from ${chatMessages.createdAt}) / 86400) * 86400)::bigint`;

export async function listRunHistory(
  before: Date | null,
  limit: number,
): Promise<{ runs: RunHistoryEntry[]; nextBefore?: string }> {
  const rows = await db
    .select({
      id: chatMessages.id,
      createdAt: chatMessages.createdAt,
      agentId: agents.id,
      agentName: agents.name,
      agentGlyph: agents.glyph,
      rating: messageRatings.value,
      dayUnix: dayExpr,
      txSig: dailyAnchors.txSig,
    })
    .from(chatMessages)
    .innerJoin(chatSessions, eq(chatMessages.sessionId, chatSessions.id))
    .innerJoin(agents, eq(chatSessions.agentId, agents.id))
    .leftJoin(messageRatings, eq(messageRatings.messageId, chatMessages.id))
    .leftJoin(
      dailyAnchors,
      and(eq(dailyAnchors.agentId, agents.id), eq(dailyAnchors.dayUnix, dayExpr)),
    )
    .where(
      and(
        eq(chatMessages.role, "agent"),
        before ? lt(chatMessages.createdAt, before) : undefined,
      ),
    )
    .orderBy(desc(chatMessages.createdAt), desc(chatMessages.id))
    .limit(limit + 1);

  // One extra row fetched = there is an older page; its cursor is the last
  // row we actually return.
  const page = rows.slice(0, limit);
  const runs = page.map((r) => ({
    id: r.id,
    createdAt: r.createdAt.toISOString(),
    agent: { id: r.agentId, name: r.agentName, glyph: r.agentGlyph },
    rating: r.rating ?? 0,
    dayUnix: Number(r.dayUnix),
    anchored: r.txSig != null,
    txSig: r.txSig ?? undefined,
  }));
  return {
    runs,
    nextBefore:
      rows.length > limit ? page[page.length - 1]!.createdAt.toISOString() : undefined,
  };
}

export async function computeHistoryStats(): Promise<HistoryStats> {
  const [{ totalRuns }] = await db
    .select({ totalRuns: sql<number>`count(*)::int` })
    .from(chatMessages)
    .where(eq(chatMessages.role, "agent"));
  const [{ anchoredDays }] = await db
    .select({ anchoredDays: sql<number>`count(*)::int` })
    .from(dailyAnchors);
  const [{ onchainAgents }] = await db
    .select({ onchainAgents: sql<number>`count(*)::int` })
    .from(agents)
    .where(sql`${agents.onchain} is not null`);
  return { totalRuns, anchoredDays, onchainAgents };
}
