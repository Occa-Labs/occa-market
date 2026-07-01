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

export const createAgentBody = z.object({
  name: z.string().trim().min(1, "name is required"),
  handle: z.string().trim().min(1, "handle is required"),
  glyph: z.string().trim().min(1).max(4).default("◇"),
  category: z.enum(["Research", "Trading", "Content", "Security", "DeFi", "Utility"]),
  tagline: z.string().trim().min(1, "tagline is required"),
  persona: z.string().trim().default(""),
  pricePerMsg: z.number().nonnegative().default(0),
  skills: z.array(z.string()).default([]),
  tools: z.array(z.string()).default([]),
  workflow: z.array(z.string()).default([]),
});

export type CreateAgentBody = z.infer<typeof createAgentBody>;
