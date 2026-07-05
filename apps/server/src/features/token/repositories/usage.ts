/*
  Budget ledger access — the only place budget_usage is read or written.
  One row per consumed free-budget message; the daily and weekly counts are
  range scans on (user_id, created_at), covered by budget_usage_user_week_idx.
*/

import { and, count, eq, gte } from "drizzle-orm";
import { db } from "../../../infra/database/client";
import { budgetUsage } from "../../../infra/database/schema";
import { dayStart, weekStart } from "../domain/week";

async function countSince(userId: string, since: Date): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(budgetUsage)
    .where(and(eq(budgetUsage.userId, userId), gte(budgetUsage.createdAt, since)));
  return row?.value ?? 0;
}

export async function countUsedThisWeek(userId: string): Promise<number> {
  return countSince(userId, weekStart());
}

export async function countUsedToday(userId: string): Promise<number> {
  return countSince(userId, dayStart());
}

export async function recordUsage(userId: string, agentId: string): Promise<void> {
  await db.insert(budgetUsage).values({ userId, agentId });
}
