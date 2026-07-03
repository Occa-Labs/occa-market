/*
  Compile an agent into the flat workspace files the gateway seeds.

  Ported from @occa/adapter-claude-code (buildClaudeMd / buildSeedFileList),
  adapted to the market's AgentDetail shape. The gateway writes files flat into
  the agent's workspace (no nested paths), so the whole identity — persona,
  skills, tools, workflow — is assembled into a single CLAUDE.md that Claude
  Code auto-loads at session start. We reuse the existing systemPrompt() as the
  body of that CLAUDE.md, so the gateway path and the direct-API path describe
  the agent identically.

  Skills are labels here (names), not multi-file Claude Code skills. When we
  need real auto-invoked skills, each would become its own .claude/skills/<name>/
  SKILL.md — which also requires relaxing the gateway's flat-file guard.

  Tools are provider-brought MCP servers: their configs compile into a single
  .mcp.json at the workspace root (flat — passes the gateway's filename guard).
  NOTE for the run wiring: headless `claude -p` does not auto-trust project
  .mcp.json servers; the run path must pass --mcp-config (or pre-approve the
  project) and allow the mcp__<name>__* tools via allowedTools.
*/

import type {
  AgentDetail,
  AgentSkillInput,
  AgentToolInput,
  MarketAgent,
} from "@occa-market/shared";
import { systemPrompt } from "./prompts";

export type SeedFile = { filename: string; content: string };

export function buildClaudeMd(
  agent: MarketAgent,
  detail: AgentDetail,
  skills: AgentSkillInput[] = [],
): string {
  const lines = [
    "# Agent context (managed by OCCA — do not edit)",
    "",
    "Your identity, skills, and operating notes are below. Treat them as",
    "authoritative.",
    "",
    systemPrompt(agent, detail),
  ];
  // Embed each brought skill's full instruction content, occa-style, so the
  // agent has the actual capability — not just the skill's name.
  const withContent = skills.filter((s) => s.markdown.trim().length > 0);
  if (withContent.length > 0) {
    lines.push("", "# Assigned skills", "", "Full content below — read before acting.");
    for (const s of withContent) {
      const desc = s.description ? ` — ${s.description}` : "";
      lines.push("", `## skill: ${s.name}${desc}`, "", s.markdown.trim());
    }
  }
  return lines.join("\n");
}

/**
 * Compile the brought tools into standard MCP JSON ({ mcpServers: { name: … } }).
 * Entries without a config are display-only labels (e.g. template forks) and
 * are skipped — an empty server entry would just fail to connect at runtime.
 * Returns null when nothing is seedable, so callers can omit the file.
 */
export function buildMcpJson(tools: AgentToolInput[]): string | null {
  const withConfig = tools.filter(
    (t) => t.name && Object.keys(t.config).length > 0,
  );
  if (withConfig.length === 0) return null;
  const mcpServers: Record<string, unknown> = {};
  for (const t of withConfig) mcpServers[t.name] = t.config;
  return `${JSON.stringify({ mcpServers }, null, 2)}\n`;
}

/** The flat file list shipped to POST /v1/seed. */
export function buildSeedFiles(
  agent: MarketAgent,
  detail: AgentDetail,
  skills: AgentSkillInput[] = [],
  tools: AgentToolInput[] = [],
): SeedFile[] {
  const files: SeedFile[] = [
    { filename: "CLAUDE.md", content: buildClaudeMd(agent, detail, skills) },
  ];
  const mcp = buildMcpJson(tools);
  if (mcp) files.push({ filename: ".mcp.json", content: mcp });
  return files;
}
