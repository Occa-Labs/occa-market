/*
  Read-only chat message stream — the one place a conversation is rendered.
  Used live by the chat page and statically by the public share page, so it
  stays hook-free and server-compatible.
*/

import { SampleOutput } from "@/components/sample-output";
import type { MarketAgent, OutputBlock } from "@occa-market/shared";

export type StreamItem = {
  role: "user" | "agent";
  text?: string;
  blocks?: OutputBlock[];
};

export function ChatStream({
  agent,
  items,
}: {
  agent: MarketAgent;
  items: StreamItem[];
}) {
  return (
    <>
      {items.map((m, i) =>
        m.role === "user" ? (
          <div key={i} className="flex justify-end">
            <div className="max-w-[80%] rounded-2xl rounded-br-md border border-line bg-surface-2 px-4 py-2.5 font-mono text-sm text-fg">
              {m.text}
            </div>
          </div>
        ) : (
          <SampleOutput
            key={i}
            agent={agent}
            output={{ prompt: "", blocks: m.blocks ?? [] }}
          />
        ),
      )}
    </>
  );
}
