/*
  GatewayRuntime — runs a turn on the provider's own gateway (BYORT).

  The seeded workspace already carries the agent's identity (CLAUDE.md with
  persona, skills, playbook) and its MCP config (.mcp.json), and the gateway
  keeps conversation continuity in Claude Code's own session store (keyed by
  our sessionKey). So a turn here is thin: user message in, reply out — no
  system prompt, no history replay.

  allowedTools: each brought MCP server is allowed at the server level
  (mcp__<name> covers every tool it exposes), plus read-only workspace tools.
  NOTE: MCP tools only actually load once the gateway passes --mcp-config to
  headless claude (gateway-side change); until then runs are text + read-only.
*/

import type { RuntimeResult } from "@occa-market/shared";
import { gatewayRun } from "../../../../infra/gateway/client";
import type { AgentRow } from "../../../../infra/database/schema";
import { toSummaryBlocks } from "./prompts";
import type { RuntimeInput } from "./runtime";

const RUN_TIMEOUT_MS = 120_000;

export class GatewayRuntime {
  /** Run one turn for a row that carries a runtime binding. */
  async run(row: AgentRow, input: RuntimeInput): Promise<RuntimeResult> {
    const binding = row.runtime;
    if (!binding) return { ok: false, error: "agent has no runtime binding" };

    const allowedTools = [
      ...row.toolConfigs
        .filter((t) => Object.keys(t.config).length > 0)
        .map((t) => `mcp__${t.name}`),
      "Read",
      "Grep",
      "Glob",
    ];

    const result = await gatewayRun(
      { gatewayUrl: binding.gatewayUrl, apiKey: binding.apiKey },
      {
        externalAgentId: binding.externalAgentId,
        prompt: input.message,
        model: binding.model,
        // Namespaced so a market thread can never collide with another
        // caller's session on the same gateway.
        sessionKey: `market:${row.id}:${input.sessionKey}`,
        allowedTools,
        timeoutMs: RUN_TIMEOUT_MS,
      },
    );

    if (!result.ok) {
      return {
        ok: false,
        error: result.reason ?? result.error ?? "gateway run failed",
      };
    }
    return {
      ok: true,
      blocks: toSummaryBlocks(result.reply),
      usage: { costUsd: row.pricePerMsg },
    };
  }
}
