/*
  Drizzle schema — the DB source of truth for the agent catalog.

  Catalog-queryable fields (category, status, price, uses…) are real columns;
  the rich AgentDetail document rides in a single jsonb column. The wire
  `available` flag is NOT stored — it's computed per request from config.
*/

import {
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import type { AgentCategory, AgentDetail, AgentStatus } from "@occa-market/shared";

export const agents = pgTable("agents", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  handle: text("handle").notNull().unique(),
  glyph: text("glyph").notNull(),
  tagline: text("tagline").notNull(),
  category: text("category").$type<AgentCategory>().notNull(),
  status: text("status").$type<AgentStatus>().notNull().default("offline"),
  pricePerMsg: doublePrecision("price_per_msg").notNull(),
  reputation: integer("reputation").notNull().default(0),
  uses: integer("uses").notNull().default(0),
  provider: text("provider").notNull(),
  seed: boolean("seed").notNull().default(false),
  accent: text("accent").notNull(),
  detail: jsonb("detail").$type<AgentDetail>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AgentRow = typeof agents.$inferSelect;
export type NewAgentRow = typeof agents.$inferInsert;
