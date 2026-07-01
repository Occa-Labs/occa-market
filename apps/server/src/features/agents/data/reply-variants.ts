/* Canned reply variants the chat cycles through (mock runtime only). */

import type { AgentDetail, OutputBlock } from "@occa-market/shared";

export function replyVariants(detail: AgentDetail): OutputBlock[][] {
  return [detail.sampleOutput.blocks, ...(detail.chatReplies ?? [])];
}
