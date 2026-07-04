/*
  Daily-anchor data access — the worklist and inputs for the on-chain anchor
  job, plus the mirrored anchor rows the UI reads. Only complete UTC days are
  ever anchorable: the on-chain PDA allows one root per (deployment, day), so
  a partial day must never be committed.
*/

import { and, desc, eq, lt, sql } from "drizzle-orm";
import { db } from "../../../infra/database/client";
import {
  agents,
  chatMessages,
  chatSessions,
  dailyAnchors,
  messageRatings,
  type AgentRow,
  type DailyAnchorRow,
} from "../../../infra/database/schema";

const DAY_SECONDS = 86_400;

export function utcDayStart(now = new Date()): number {
  return Math.floor(now.getTime() / 1000 / DAY_SECONDS) * DAY_SECONDS;
}

/** Agents that carry an on-chain deployment — the anchor job's scope. */
export async function listOnchainAgents(): Promise<AgentRow[]> {
  return db.select().from(agents).where(sql`${agents.onchain} is not null`);
}

/**
 * Complete UTC days (unix midnight, ascending) that hold agent replies for
 * this agent but no anchor row yet.
 */
export async function listUnanchoredDays(agentId: string): Promise<number[]> {
  // The day expression is inlined (86400 literal, no bind params) so the
  // GROUP BY clause is structurally identical to the SELECT expression —
  // parameterized copies render as distinct $n placeholders and Postgres
  // rejects the grouping.
  const dayExpr = sql<number>`(floor(extract(epoch from ${chatMessages.createdAt}) / 86400) * 86400)::bigint`;
  const rows = await db
    .select({ day: dayExpr })
    .from(chatMessages)
    .innerJoin(chatSessions, eq(chatMessages.sessionId, chatSessions.id))
    .where(and(eq(chatSessions.agentId, agentId), eq(chatMessages.role, "agent")))
    .groupBy(dayExpr)
    .having(lt(dayExpr, utcDayStart()))
    .orderBy(dayExpr);

  if (rows.length === 0) return [];
  const anchored = await db
    .select({ day: dailyAnchors.dayUnix })
    .from(dailyAnchors)
    .where(eq(dailyAnchors.agentId, agentId));
  const done = new Set(anchored.map((r) => Number(r.day)));
  return rows.map((r) => Number(r.day)).filter((d) => !done.has(d));
}

export type DayExchange = {
  messageId: string;
  text: string | null;
  blocks: unknown;
  rating: number;
};

/** The agent's replies (with buyer thumbs) inside one UTC day, stable order. */
export async function listDayExchanges(
  agentId: string,
  dayUnix: number,
): Promise<DayExchange[]> {
  const from = new Date(dayUnix * 1000);
  const to = new Date((dayUnix + DAY_SECONDS) * 1000);
  const rows = await db
    .select({
      messageId: chatMessages.id,
      text: chatMessages.text,
      blocks: chatMessages.blocks,
      rating: messageRatings.value,
      createdAt: chatMessages.createdAt,
    })
    .from(chatMessages)
    .innerJoin(chatSessions, eq(chatMessages.sessionId, chatSessions.id))
    .leftJoin(messageRatings, eq(messageRatings.messageId, chatMessages.id))
    .where(
      and(
        eq(chatSessions.agentId, agentId),
        eq(chatMessages.role, "agent"),
        sql`${chatMessages.createdAt} >= ${from} and ${chatMessages.createdAt} < ${to}`,
      ),
    )
    .orderBy(chatMessages.createdAt, chatMessages.id);
  return rows.map((r) => ({
    messageId: r.messageId,
    text: r.text,
    blocks: r.blocks,
    rating: r.rating ?? 0,
  }));
}

export async function insertDailyAnchor(row: {
  agentId: string;
  dayUnix: number;
  merkleRoot: string;
  taskCount: number;
  txSig: string;
}): Promise<void> {
  await db.insert(dailyAnchors).values(row);
}

export async function getLatestAnchor(
  agentId: string,
): Promise<DailyAnchorRow | null> {
  const [row] = await db
    .select()
    .from(dailyAnchors)
    .where(eq(dailyAnchors.agentId, agentId))
    .orderBy(desc(dailyAnchors.dayUnix))
    .limit(1);
  return row ?? null;
}

export async function countAnchors(agentId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(dailyAnchors)
    .where(eq(dailyAnchors.agentId, agentId));
  return row?.n ?? 0;
}
