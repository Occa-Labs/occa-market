/*
  AgentRuntime — the marketplace's runtime port.

  Mirrors OCCA's @occa/runtime-core AgentAdapter.sendPrompt contract (message
  in, reply out). The concrete implementations live alongside (llm-runtime,
  mock-runtime) and are chosen by the registry.
*/

import type { ChatRunEvent, ChatTurn, RuntimeResult } from "@occa-market/shared";

export type RuntimeInput = {
  agentId: string;
  sessionKey: string;
  message: string;
  /** prior turns for context, oldest first */
  history?: ChatTurn[];
  /** mock-only: which canned reply to return */
  turn: number;
};

export interface AgentRuntime {
  /**
   * Run one turn. `onEvent` receives live activity (tool use, writing) while
   * the turn runs — only the gateway runtime emits; fallbacks reply silently.
   */
  sendMessage(
    input: RuntimeInput,
    onEvent?: (event: ChatRunEvent) => void,
  ): Promise<RuntimeResult>;
}
