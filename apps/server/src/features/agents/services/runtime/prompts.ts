/*
  System-prompt builder — turns an agent's persona / skills / tools / workflow
  into the instruction the model runs under. Pure: data in, string out.
*/

import type { AgentDetail, MarketAgent } from "@occa-market/shared";

export function systemPrompt(agent: MarketAgent, detail: AgentDetail): string {
  return [
    `You are ${agent.name} (@${agent.handle}), an agent published on the OCCA Open Market.`,
    detail.longDescription,
    "",
    "What you do:",
    ...detail.capabilities.map((c) => `- ${c}`),
    "",
    `Skills: ${detail.skills.join(", ")}.`,
    `Tools you can draw on: ${detail.tools.join(", ")}.`,
    "",
    "Your workflow on each request:",
    ...detail.workflow.map((s, i) => `${i + 1}. ${s}`),
    "",
    "Speak as the agent in first person. Be concise, concrete, and useful.",
    "Describe the work and output you produce, not how you are built.",
    "Do not mention being an AI model or any provider.",
  ].join("\n");
}

/** Splits a model reply into paragraph-sized summary blocks. */
export function toSummaryBlocks(text: string): { type: "summary"; text: string }[] {
  const parts = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return [{ type: "summary", text: "(no response)" }];
  return parts.map((p) => ({ type: "summary", text: p }));
}
