/*
  MockRuntime — fallback when no ANTHROPIC_API_KEY is set. Returns canned reply
  variants for the chat demo. Never calls a model.
*/

import type { RuntimeResult } from "@occa-market/shared";
import { replyVariants } from "../../data/reply-variants";
import { getAgent, getAgentDetail } from "../../repositories/agents";
import type { AgentRuntime, RuntimeInput } from "./runtime";

export class MockRuntime implements AgentRuntime {
  async sendMessage({ agentId, turn }: RuntimeInput): Promise<RuntimeResult> {
    const agent = await getAgent(agentId);
    if (!agent) return { ok: false, error: "unknown agent" };
    if (agent.status !== "online") return { ok: false, error: "agent offline" };

    const detail = await getAgentDetail(agentId);
    if (!detail) return { ok: false, error: "unknown agent" };

    const variants = replyVariants(detail);
    const blocks = variants[((turn % variants.length) + variants.length) % variants.length];
    return { ok: true, blocks, usage: { costUsd: agent.pricePerMsg } };
  }
}
