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
*/

import type {
  AgentDetail,
  AgentSkillInput,
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

/** The flat file list shipped to POST /v1/seed. */
export function buildSeedFiles(
  agent: MarketAgent,
  detail: AgentDetail,
  skills: AgentSkillInput[] = [],
): SeedFile[] {
  return [{ filename: "CLAUDE.md", content: buildClaudeMd(agent, detail, skills) }];
}
