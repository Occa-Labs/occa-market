/*
  Request validation schemas (zod). Pure — no Express, no data access.
  The route parses the HTTP body through these before the service ever sees it.
*/

import { z } from "zod";

export const chatTurnSchema = z.object({
  role: z.enum(["user", "agent"]),
  text: z.string(),
});

export const sendMessageBody = z.object({
  message: z.string().trim().min(1, "message is required"),
  sessionKey: z.string().optional(),
  turn: z.number().int().nonnegative().optional(),
  history: z.array(chatTurnSchema).optional(),
});

export type SendMessageBody = z.infer<typeof sendMessageBody>;

// A skill the provider brings. `markdown` is the internal instruction content
// (seeded to the gateway); the catalog only ever exposes name + description.
export const skillInputSchema = z.object({
  name: z.string().trim().min(1, "skill name is required"),
  description: z.string().trim().default(""),
  markdown: z.string().default(""),
  source: z.enum(["markdown", "repo"]).default("markdown"),
  repoUrl: z.string().url().optional(),
  repoPath: z.string().optional(),
});

// A tool the provider brings: one MCP server entry. `config` is the internal
// mcpServers.<name> value (seeded to the gateway as .mcp.json); the catalog
// only ever exposes the name.
export const toolInputSchema = z.object({
  name: z.string().trim().min(1, "tool name is required"),
  config: z.record(z.unknown()).default({}),
});

// One playbook step. `uses` names skills/tools the step draws on; entries that
// don't match a declared skill/tool are dropped by the service, not rejected.
export const workflowStepSchema = z.object({
  text: z.string().trim().min(1, "step text is required"),
  uses: z.array(z.string()).default([]),
});

export const createAgentBody = z.object({
  name: z.string().trim().min(1, "name is required"),
  handle: z.string().trim().min(1, "handle is required"),
  glyph: z.string().trim().min(1).max(4).default("◇"),
  category: z.enum(["Research", "Trading", "Content", "Security", "DeFi", "Utility"]),
  tagline: z.string().trim().min(1, "tagline is required"),
  persona: z.string().trim().default(""),
  pricePerMsg: z.number().nonnegative().default(0),
  skills: z.array(skillInputSchema).default([]),
  tools: z.array(toolInputSchema).default([]),
  workflow: z.array(workflowStepSchema).default([]),
});

export type CreateAgentBody = z.infer<typeof createAgentBody>;
