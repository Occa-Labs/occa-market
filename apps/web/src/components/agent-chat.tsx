"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SampleOutput } from "@/components/sample-output";
import type { ChatMessage, MarketAgent, OutputBlock } from "@occa-market/shared";
import { getChatHistory, sendMessage } from "@/lib/api";
import { config } from "@/lib/config";
import { useAuth } from "@/components/auth/auth-provider";

type Message =
  | { role: "user"; text: string }
  | { role: "agent"; blocks: OutputBlock[] };

function fromStored(m: ChatMessage): Message {
  return m.role === "user"
    ? { role: "user", text: m.text ?? "" }
    : { role: "agent", blocks: m.blocks ?? [] };
}

export function AgentChat({
  agent,
  examplePrompts,
}: {
  agent: MarketAgent;
  examplePrompts: string[];
}) {
  const price = agent.pricePerMsg;

  const greeting: Message = {
    role: "agent",
    blocks: [
      {
        type: "summary",
        text: `Hey, I'm ${agent.name}. ${agent.tagline} Ask me anything to get started.`,
      },
    ],
  };

  const [messages, setMessages] = useState<Message[]>([greeting]);
  const [input, setInput] = useState("");
  const [credit, setCredit] = useState(config.welcomeCredit);
  const [sending, setSending] = useState(false);

  // Dev/admin wallets ride free — no metering, no top-up gate. Client-side
  // courtesy only; the server-side ledger will enforce the same allowlist.
  const { user, status, signIn } = useAuth();
  const unmetered =
    !!user?.walletAddress && config.devWallets.includes(user.walletAddress);

  const signedOut = status === "unauthenticated" || status === "disabled";
  const broke = !unmetered && credit < price;

  // The thread lives server-side, keyed by the signed-in user — pull it once
  // the session resolves. The greeting is client-only and always leads.
  useEffect(() => {
    if (status !== "authenticated") return;
    let active = true;
    void getChatHistory(agent.id).then((stored) => {
      if (!active || !stored?.length) return;
      setMessages((prev) => [prev[0], ...stored.map(fromStored)]);
    });
    return () => {
      active = false;
    };
  }, [status, agent.id]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || broke || sending || status !== "authenticated") return;

    setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
    setInput("");
    setSending(true);

    try {
      const data = await sendMessage(agent.id, { message: trimmed });

      if (data.ok) {
        setMessages((prev) => [...prev, { role: "agent", blocks: data.blocks }]);
        if (!unmetered) {
          setCredit((c) =>
            Math.max(0, +(c - (data.usage?.costUsd ?? price)).toFixed(2)),
          );
        }
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "agent",
            blocks: [{ type: "summary", text: "Something went wrong. Try again." }],
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "agent",
          blocks: [{ type: "summary", text: "Couldn't reach the agent." }],
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 sm:px-6">
      {/* chat header — identity + live credit */}
      <div className="mb-5 flex items-center justify-between gap-3">
        <Link
          href={`/agents/${agent.id}`}
          className="flex items-center gap-2.5 font-mono text-xs text-muted transition-colors hover:text-fg"
        >
          <ArrowLeft size={14} className="text-faint" />
          <span className="spotlight flex h-8 w-8 items-center justify-center rounded-lg border border-line text-sm text-fg">
            {agent.glyph}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-fg">{agent.name}</span>
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          </span>
        </Link>

        {!signedOut && (
          <span
            className={`rounded-full border bg-surface-2 px-3 py-1 font-mono text-xs tabular-nums ${
              broke ? "border-warn/30 text-warn" : "border-line text-muted"
            }`}
          >
            {unmetered ? "dev · unmetered" : `$${credit.toFixed(2)} credit`}
          </span>
        )}
      </div>

      {/* message stream */}
      <div className="flex flex-col gap-4">
        {messages.map((m, i) =>
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
              output={{ prompt: "", blocks: m.blocks }}
            />
          ),
        )}
        {sending && <Typing agent={agent} />}
      </div>

      {/* composer / sign-in gate / top-up gate */}
      <div className="sticky bottom-4 mt-6">
        {signedOut ? (
          <Card className="p-5 text-center">
            <p className="font-mono text-sm text-fg">Sign in to chat</p>
            <p className="mx-auto mt-1 max-w-sm font-mono text-xs leading-relaxed text-muted">
              Your conversation with {agent.name} is saved to your account, so
              you can pick it up anytime.
            </p>
            <Button size="md" className="mt-4" onClick={signIn}>
              Sign in
            </Button>
          </Card>
        ) : broke ? (
          <Card className="p-5 text-center">
            <p className="font-mono text-sm text-fg">Out of free credit</p>
            <p className="mx-auto mt-1 max-w-sm font-mono text-xs leading-relaxed text-muted">
              Your welcome credit is used up. Top up with USDC to keep using{" "}
              {agent.name}.
            </p>
            <Button size="md" className="mt-4">
              Top up with USDC
            </Button>
          </Card>
        ) : (
          <Card className="p-4">
            <div className="mb-3 flex flex-wrap gap-2">
              {examplePrompts.slice(0, 3).map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  disabled={sending}
                  onClick={() => send(prompt)}
                  className="cursor-pointer rounded-full border border-line bg-surface-2 px-3 py-1 font-mono text-xs text-muted transition-colors hover:border-line-strong hover:text-fg disabled:opacity-50"
                >
                  {prompt}
                </button>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="flex items-center gap-2"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={`Ask ${agent.name}…`}
                className="h-10 flex-1 rounded-xl border border-line bg-surface-2 px-3.5 font-mono text-sm text-fg placeholder:text-faint focus:border-line-strong focus:outline-none"
              />
              <Button size="lg" type="submit" disabled={!input.trim() || sending}>
                {sending ? "…" : "Send"}
              </Button>
            </form>

            <p className="mt-2 text-right font-mono text-[0.7rem] text-faint">
              ${price.toFixed(2)} USDC per message
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}

function Typing({ agent }: { agent: MarketAgent }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="spotlight flex h-8 w-8 flex-none items-center justify-center rounded-lg border border-line text-sm text-fg">
        {agent.glyph}
      </span>
      <span className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="live-dot h-1.5 w-1.5 rounded-full bg-faint"
            style={{ animationDelay: `${i * 0.2}s` }}
          />
        ))}
      </span>
    </div>
  );
}
