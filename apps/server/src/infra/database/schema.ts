/*
  Drizzle schema — the DB source of truth for the agent catalog.

  Catalog-queryable fields (category, status, price, uses…) are real columns;
  the rich AgentDetail document rides in a single jsonb column. The wire
  `available` flag is NOT stored — it's computed per request from config.
*/

import {
  bigint,
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import type {
  AgentCategory,
  AgentDetail,
  AgentRuntimeInput,
  AgentSkillInput,
  AgentStatus,
  AgentToolInput,
  OutputBlock,
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
  // Internal: the BYORT runtime binding (gateway address + bearer + model +
  // externalAgentId). Secret-bearing — never leaves the server. Plaintext for
  // the local MVP; needs encryption-at-rest before any hosted deploy.
  runtime: jsonb("runtime").$type<AgentRuntimeInput>(),
  // Who published this agent. Nullable for rows that predate ownership; the
  // owner (and only the owner) can read the source and push revisions.
  ownerUserId: uuid("owner_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  // On-chain footprint under the "OCCA Market" company (OCCA registry,
  // devnet): AgentIdentity + Deployment PDAs minted at registration. Null =
  // not registered yet; the daily anchor job only covers registered agents.
  onchain: jsonb("onchain").$type<AgentOnchainInfo>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AgentOnchainInfo = {
  agentPubkey: string;
  identityPda: string;
  deploymentPda: string;
  deploymentIndex: number;
};

export type AgentRow = typeof agents.$inferSelect;
export type NewAgentRow = typeof agents.$inferInsert;

/*
  Chat sessions — one row per conversation. A user holds many sessions per
  agent; the session is the thread (and the runtime continuity key). Titled
  from the first user message; lastMessageAt drives the list order.
*/
export const chatSessions = pgTable(
  "chat_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: text("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    // Public share handle. Non-null = anyone with the link can read the
    // session at /share/<shareId>; null = private (the default).
    shareId: uuid("share_id").unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("chat_sessions_owner_idx").on(t.agentId, t.userId, t.lastMessageAt)],
);

export type ChatSessionRow = typeof chatSessions.$inferSelect;

/*
  Chat history — one row per message, owned by a session. User rows carry
  `text`, agent rows carry the reply `blocks`. The client-side greeting is
  never stored.
*/
export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => chatSessions.id, { onDelete: "cascade" }),
    role: text("role").$type<"user" | "agent">().notNull(),
    text: text("text"),
    blocks: jsonb("blocks").$type<OutputBlock[]>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("chat_messages_session_idx").on(t.sessionId, t.createdAt)],
);

export type ChatMessageRow = typeof chatMessages.$inferSelect;
export type NewChatMessageRow = typeof chatMessages.$inferInsert;

/*
  Buyer feedback — one thumbs per agent reply (+1 / −1). agent_id is
  denormalized so reputation aggregates don't need the session join; the
  message link keeps every rating auditable back to a real conversation.
*/
export const messageRatings = pgTable(
  "message_ratings",
  {
    messageId: uuid("message_id")
      .primaryKey()
      .references(() => chatMessages.id, { onDelete: "cascade" }),
    agentId: text("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    value: integer("value").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("message_ratings_agent_idx").on(t.agentId)],
);

export type MessageRatingRow = typeof messageRatings.$inferSelect;

/*
  Daily anchors — one row per (agent, UTC day) committed on-chain via the
  registry's commit_daily_anchor. Mirrors the DailyAnchorAccount so reads
  never need an RPC round-trip; the chain stays the tamper-evident source.
*/
export const dailyAnchors = pgTable(
  "daily_anchors",
  {
    agentId: text("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    // UTC midnight of the anchored day, unix seconds — the on-chain PDA seed.
    dayUnix: bigint("day_unix", { mode: "number" }).notNull(),
    merkleRoot: text("merkle_root").notNull(),
    taskCount: integer("task_count").notNull(),
    txSig: text("tx_sig").notNull(),
    committedAt: timestamp("committed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.agentId, t.dayUnix] })],
);

export type DailyAnchorRow = typeof dailyAnchors.$inferSelect;
