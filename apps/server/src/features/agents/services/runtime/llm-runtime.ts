/*
  LLMRuntime — the real runtime. Calls the Claude API as the agent, with its
  persona / skills / tools / workflow as the system prompt, and maps the reply
  to `summary` blocks.

  Note on block types: rich blocks (launchScan, metrics) need real data feeds
  to be truthful, so a raw model reply maps to plain summary blocks. Wiring the
  OCCA gateway adapters (real tools) is what unlocks the rich blocks later.
*/

import Anthropic from "@anthropic-ai/sdk";
import type { RuntimeResult } from "@occa-market/shared";
import { env } from "../../../../config/env";
import { getAgent, getAgentDetail } from "../../repositories/agents";
import { systemPrompt, toReplyBlocks } from "./prompts";
import type { AgentRuntime, RuntimeInput } from "./runtime";

export class LLMRuntime implements AgentRuntime {
  private client = new Anthropic({ apiKey: env.anthropicApiKey });

  async sendMessage(input: RuntimeInput): Promise<RuntimeResult> {
    const agent = await getAgent(input.agentId);
    if (!agent) return { ok: false, error: "unknown agent" };
    if (agent.status !== "online") return { ok: false, error: "agent offline" };

    const detail = await getAgentDetail(input.agentId);
    if (!detail) return { ok: false, error: "unknown agent" };

    const history = (input.history ?? []).map((m) => ({
      role: m.role === "agent" ? ("assistant" as const) : ("user" as const),
      content: m.text,
    }));

    try {
      const res = await this.client.messages.create({
        model: env.runtimeModel,
        max_tokens: env.runtimeMaxTokens,
        system: systemPrompt(agent, detail),
        messages: [...history, { role: "user", content: input.message }],
      });
      const text = res.content
        .filter((b) => b.type === "text")
        .map((b) => (b.type === "text" ? b.text : ""))
        .join("\n")
        .trim();
      return {
        ok: true,
        blocks: toReplyBlocks(text),
        usage: { costUsd: agent.pricePerMsg },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "runtime error";
      return { ok: false, error: message };
    }
  }
}
