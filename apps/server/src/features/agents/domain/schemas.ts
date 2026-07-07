/*
  Request validation schemas (zod). Pure — no Express, no data access.
  The route parses the HTTP body through these before the service ever sees it.
*/

import { z } from "zod";

// Turn and history are derived server-side from the stored session. Omitting
// sessionId starts a fresh session, titled from the message.
export const sendMessageBody = z.object({
  message: z.string().trim().min(1, "message is required"),
  sessionId: z.string().uuid().optional(),
});

// Thumbs on an agent reply: +1 / −1 set, 0 clears.
export const rateMessageBody = z.object({
  value: z.union([z.literal(1), z.literal(-1), z.literal(0)]),
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

// A gateway URL carries a bearer, so it must not cross the wire in the clear:
// require https, with a carve-out for loopback so local dev (http://localhost)
// still connects. Shared by every gateway address a bearer rides with — the
// runtime binding and the wizard's connection probe.
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

function isSecureGatewayUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol === "https:") return true;
  return url.protocol === "http:" && LOOPBACK_HOSTS.has(url.hostname);
}

const secureGatewayUrl = z
  .string()
  .trim()
  .url("gatewayUrl must be a valid http(s) URL")
  .refine(isSecureGatewayUrl, {
    message: "gatewayUrl must use https (http is allowed only for localhost)",
  })
  // Normalized without a trailing slash — the client appends /v1/… paths.
  .transform((u) => u.replace(/\/+$/, ""));

// A provider's gateway address.
export const gatewayTargetSchema = z.object({
  gatewayUrl: secureGatewayUrl,
  apiKey: z.string().trim().optional(),
});

// The full BYORT runtime binding an agent publishes with. Internal — the
// bearer must never reach a public projection.
export const runtimeInputSchema = z.object({
  adapterType: z.enum(["claude-code", "openclaw", "codex", "hermes"]),
  gatewayUrl: secureGatewayUrl,
  apiKey: z.string().trim().optional(),
  model: z.string().trim().min(1, "model is required"),
  externalAgentId: z.string().trim().min(1, "externalAgentId is required"),
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
  runtime: runtimeInputSchema,
});

export type CreateAgentBody = z.infer<typeof createAgentBody>;

// Revision keeps the handle (it's the id); an omitted runtime apiKey means
// "keep the stored secret".
export const updateAgentBody = createAgentBody.omit({ handle: true });

export type UpdateAgentBody = z.infer<typeof updateAgentBody>;
