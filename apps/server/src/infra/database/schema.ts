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
  uuid,
} from "drizzle-orm/pg-core";
import type {
  AgentCategory,
  AgentDetail,
  AgentSkillInput,
  AgentStatus,
  AgentToolInput,
} from "@occa-market/shared";

/*
  Users — identity is the Privy DID (stable across wallet + email login).
  Wallet and email are captured from the Privy account on login and refreshed
  each time; either may be null depending on how the user signed in.
*/
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  privyDid: text("privy_did").notNull().unique(),
  walletAddress: text("wallet_address"),
  email: text("email"),
  name: text("name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;

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
  // Internal: full skill content (SKILL.md markdown + source), seeded to the
  // gateway workspace. Never exposed in the public catalog (blueprint §12).
  skillSources: jsonb("skill_sources").$type<AgentSkillInput[]>().notNull().default([]),
  // Internal: MCP server configs for provider-brought tools — seeded to the
  // gateway workspace as .mcp.json. Same visibility rule as skillSources.
  toolConfigs: jsonb("tool_configs").$type<AgentToolInput[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AgentRow = typeof agents.$inferSelect;
export type NewAgentRow = typeof agents.$inferInsert;
