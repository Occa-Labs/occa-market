/*
  Runtime registry — the pluggable-backend seam (mirrors OCCA's adapter
  registry). Dispatch is per agent: a BYORT agent (stored runtime binding)
  runs on its provider's gateway; everything else falls back to the
  config-selected runtime — the Claude API with a real ANTHROPIC_API_KEY,
  the canned MockRuntime without.
*/

import { env } from "../../../../config/env";
import { getAgentRow } from "../../repositories/agents";
import { GatewayRuntime } from "./gateway-runtime";
import { LLMRuntime } from "./llm-runtime";
import { MockRuntime } from "./mock-runtime";
import type { AgentRuntime, RuntimeInput } from "./runtime";
import type { RuntimeResult } from "@occa-market/shared";

const factories = {
  llm: () => new LLMRuntime(),
  mock: () => new MockRuntime(),
} satisfies Record<string, () => AgentRuntime>;

function selectFallback(): AgentRuntime {
  if (env.anthropicApiKey) return factories.llm();
  console.warn(
    "[runtime] ANTHROPIC_API_KEY not set — falling back to canned MockRuntime. Set the key for real agent replies.",
  );
  return factories.mock();
}

class DispatchRuntime implements AgentRuntime {
  private gateway = new GatewayRuntime();

  constructor(private fallback: AgentRuntime) {}

  async sendMessage(input: RuntimeInput): Promise<RuntimeResult> {
    const row = await getAgentRow(input.agentId);
    if (!row) return { ok: false, error: "unknown agent" };
    if (row.runtime) return this.gateway.run(row, input);
    return this.fallback.sendMessage(input);
  }
}

export const runtime: AgentRuntime = new DispatchRuntime(selectFallback());
