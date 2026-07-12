/*
  Market-wide run history — every agent run across the catalog, newest first.
  Two rails feed it: stored chat replies (joined with buyer thumbs, their day's
  on-chain anchor, and any credit charge that paid for them) and machine x402
  calls (which never persist a chat message, so they surface straight from the
  charge book, with the settlement transaction as their on-chain record).
  Metadata only: message content never leaves the session it belongs to.
*/

import { and, desc, eq, lt, sql } from "drizzle-orm";
import type { HistoryStats, RunHistoryEntry } from "@occa-market/shared";
import { db } from "../../../infra/database/client";
import {
  agents,
  chatMessages,
  chatSessions,
  creditLedger,
  dailyAnchors,
  messageRatings,
  x402Charges,
} from "../../../infra/database/schema";

// Inlined 86400 (no bind params) — must stay structurally identical between
// the select and the join condition.
const dayExpr = sql<number>`(floor(extract(epoch from ${chatMessages.createdAt}) / 86400) * 86400)::bigint`;

// A run row as assembled in memory before serialization; createdAt kept as a
// Date so the two rails can be merged by real time.
type MergedRun = Omit<RunHistoryEntry, "createdAt"> & { createdAt: Date };

function dayUnixOf(at: Date): number {
  return Math.floor(at.getTime() / 1000 / 86400) * 86400;
}

export async function listRunHistory(
  before: Date | null,
  limit: number,
): Promise<{ runs: RunHistoryEntry[]; nextBefore?: string }> {
  // Chat runs: one row per stored agent reply, with rating, anchor, and the
  // credit charge (if any) that paid for it.
  const chatRows = await db
    .select({
      id: chatMessages.id,
      createdAt: chatMessages.createdAt,
      agentId: agents.id,
      agentName: agents.name,
      agentGlyph: agents.glyph,
      rating: messageRatings.value,
      dayUnix: dayExpr,
      txSig: dailyAnchors.txSig,
      payMicros: creditLedger.priceMicros,
    })
    .from(chatMessages)
    .innerJoin(chatSessions, eq(chatMessages.sessionId, chatSessions.id))
    .innerJoin(agents, eq(chatSessions.agentId, agents.id))
    .leftJoin(messageRatings, eq(messageRatings.messageId, chatMessages.id))
    .leftJoin(
      dailyAnchors,
      and(eq(dailyAnchors.agentId, agents.id), eq(dailyAnchors.dayUnix, dayExpr)),
    )
    .leftJoin(
      creditLedger,
      and(
        eq(creditLedger.messageId, chatMessages.id),
        eq(creditLedger.kind, "charge"),
      ),
    )
    .where(
      and(
        eq(chatMessages.role, "agent"),
        before ? lt(chatMessages.createdAt, before) : undefined,
      ),
    )
    .orderBy(desc(chatMessages.createdAt), desc(chatMessages.id))
    .limit(limit + 1);

  // x402 runs: delivered machine calls. The settlement tx is their record —
  // there is no chat message and no day anchor.
  const x402Rows = await db
    .select({
      id: x402Charges.id,
      createdAt: x402Charges.createdAt,
      agentId: agents.id,
      agentName: agents.name,
      agentGlyph: agents.glyph,
      priceMicros: x402Charges.priceMicros,
      txSig: x402Charges.txSignature,
    })
    .from(x402Charges)
    .innerJoin(agents, eq(agents.id, x402Charges.agentId))
    .where(
      and(
        eq(x402Charges.delivered, true),
        before ? lt(x402Charges.createdAt, before) : undefined,
      ),
    )
    .orderBy(desc(x402Charges.createdAt))
    .limit(limit + 1);

  const merged: MergedRun[] = [
    ...chatRows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      agent: { id: r.agentId, name: r.agentName, glyph: r.agentGlyph },
      source: "run" as const,
      rating: r.rating ?? 0,
      dayUnix: Number(r.dayUnix),
      anchored: r.txSig != null,
      txSig: r.txSig ?? undefined,
      payment:
        r.payMicros != null
          ? { rail: "credits" as const, amountMicros: r.payMicros }
          : null,
    })),
    ...x402Rows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      agent: { id: r.agentId, name: r.agentName, glyph: r.agentGlyph },
      source: "x402" as const,
      rating: 0,
      dayUnix: dayUnixOf(r.createdAt),
      // The settlement transaction is itself the on-chain record.
      anchored: true,
      txSig: r.txSig,
      payment: { rail: "x402" as const, amountMicros: r.priceMicros },
    })),
  ].sort(
    (a, b) =>
      b.createdAt.getTime() - a.createdAt.getTime() ||
      (a.id < b.id ? 1 : a.id > b.id ? -1 : 0),
  );

  // Each rail fetched limit+1, so the merged list can carry more than one extra
  // row; the page is the first `limit`, and any remainder means an older page.
  const page = merged.slice(0, limit);
  const runs: RunHistoryEntry[] = page.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
  }));
  return {
    runs,
    nextBefore:
      merged.length > limit ? page[page.length - 1]!.createdAt.toISOString() : undefined,
  };
}

export async function computeHistoryStats(): Promise<HistoryStats> {
  const [{ chatRuns }] = await db
    .select({ chatRuns: sql<number>`count(*)::int` })
    .from(chatMessages)
    .where(eq(chatMessages.role, "agent"));
  const [{ x402Runs }] = await db
    .select({ x402Runs: sql<number>`count(*)::int` })
    .from(x402Charges)
    .where(eq(x402Charges.delivered, true));
  const [{ anchoredDays }] = await db
    .select({ anchoredDays: sql<number>`count(*)::int` })
    .from(dailyAnchors);
  const [{ onchainAgents }] = await db
    .select({ onchainAgents: sql<number>`count(*)::int` })
    .from(agents)
    .where(sql`${agents.onchain} is not null`);
  return { totalRuns: chatRuns + x402Runs, anchoredDays, onchainAgents };
}
