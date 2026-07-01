/*
  Agent data access — the ONLY place the catalog is read or written. Routes,
  services, and the runtime go through these helpers, so the storage engine
  (now Drizzle/Postgres) stays out of the rest of the feature.
*/

import { desc, eq } from "drizzle-orm";
import type { AgentDetail, AgentWithDetail, MarketAgent } from "@occa-market/shared";
import { db } from "../../../infra/database/client";
import { agents, type NewAgentRow } from "../../../infra/database/schema";
import { toMarketAgent } from "../domain/dtos";

// Seed agents first, then newest published agents.
export async function listAgents(): Promise<MarketAgent[]> {
  const rows = await db
    .select()
    .from(agents)
    .orderBy(desc(agents.seed), desc(agents.createdAt));
  return rows.map(toMarketAgent);
}

export async function getAgent(id: string): Promise<MarketAgent | null> {
  const [row] = await db.select().from(agents).where(eq(agents.id, id)).limit(1);
  return row ? toMarketAgent(row) : null;
}

export async function getAgentDetail(id: string): Promise<AgentDetail | null> {
  const [row] = await db.select().from(agents).where(eq(agents.id, id)).limit(1);
  return row ? row.detail : null;
}

export async function getAgentWithDetail(
  id: string,
): Promise<AgentWithDetail | null> {
  const [row] = await db.select().from(agents).where(eq(agents.id, id)).limit(1);
  return row ? { agent: toMarketAgent(row), detail: row.detail } : null;
}

export async function agentExists(id: string): Promise<boolean> {
  const [row] = await db
    .select({ id: agents.id })
    .from(agents)
    .where(eq(agents.id, id))
    .limit(1);
  return Boolean(row);
}

export async function insertAgent(row: NewAgentRow): Promise<MarketAgent> {
  const [created] = await db.insert(agents).values(row).returning();
  return toMarketAgent(created);
}
