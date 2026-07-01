/*
  Runtime registry — the pluggable-backend seam (mirrors OCCA's adapter
  registry). Selection is by config: a real ANTHROPIC_API_KEY picks the LLM
  runtime, otherwise the canned MockRuntime. Add a new runtime by adding a
  factory here and a branch in selectRuntime.
*/

import { env } from "../../../../config/env";
import { LLMRuntime } from "./llm-runtime";
import { MockRuntime } from "./mock-runtime";
import type { AgentRuntime } from "./runtime";

const factories = {
  llm: () => new LLMRuntime(),
  mock: () => new MockRuntime(),
} satisfies Record<string, () => AgentRuntime>;

function selectRuntime(): AgentRuntime {
  if (env.anthropicApiKey) return factories.llm();
  console.warn(
    "[runtime] ANTHROPIC_API_KEY not set — falling back to canned MockRuntime. Set the key for real agent replies.",
  );
  return factories.mock();
}

export const runtime: AgentRuntime = selectRuntime();
