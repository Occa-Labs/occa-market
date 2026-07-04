"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SampleOutput } from "@/components/sample-output";
import type {
  ChatMessage,
  ChatSession,
  MarketAgent,
  OutputBlock,
} from "@occa-market/shared";
import {
  deleteChatSession,
  getSessionMessages,
  listChatSessions,
  sendMessage,
} from "@/lib/api";
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

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
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

  // Sessions live server-side, keyed by the signed-in user. Pull the list once
  // the session resolves and reopen the most recent conversation.
  useEffect(() => {
    if (status !== "authenticated") return;
    let active = true;
    void listChatSessions(agent.id).then(async (stored) => {
      if (!active || !stored) return;
      setSessions(stored);
      if (stored.length === 0) return;
      const thread = await getSessionMessages(agent.id, stored[0].id);
      if (!active || !thread) return;
      setActiveId(stored[0].id);
      setMessages([greeting, ...thread.map(fromStored)]);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, agent.id]);

  async function openSession(id: string) {
    if (id === activeId || sending) return;
    setActiveId(id);
    setMessages([greeting]);
    const thread = await getSessionMessages(agent.id, id);
    if (thread) setMessages([greeting, ...thread.map(fromStored)]);
  }

  function newChat() {
    if (sending) return;
    setActiveId(null);
    setMessages([greeting]);
  }

  async function removeSession(id: string) {
    if (!(await deleteChatSession(agent.id, id))) return;
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (id === activeId) newChat();
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || broke || sending || status !== "authenticated") return;

    setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
    setInput("");
    setSending(true);

    try {
      const data = await sendMessage(agent.id, {
        message: trimmed,
        sessionId: activeId ?? undefined,
      });

      if (data.ok) {
        setMessages((prev) => [...prev, { role: "agent", blocks: data.blocks }]);
        // A fresh chat just became a real session; an existing one moves to
        // the top of the list with its new activity time.
        setActiveId(data.session.id);
        setSessions((prev) => [
          data.session,
          ...prev.filter((s) => s.id !== data.session.id),
        ]);
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

  const showSessions = status === "authenticated";

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 sm:px-6">
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

      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        {/* session rail — desktop */}
        {showSessions && (
          <aside className="hidden lg:block">
            <div className="sticky top-24">
              <p className="mb-3 font-mono text-xs uppercase tracking-[0.18em] text-faint">
                Sessions
              </p>
              <Button size="sm" variant="secondary" onClick={newChat}>
                <Plus size={13} />
                New chat
              </Button>
              <div className="mt-4 flex flex-col gap-1">
                {sessions.map((s) => (
                  <div
                    key={s.id}
                    className={`group flex items-center gap-1 rounded-lg border px-2.5 py-2 transition-colors ${
                      s.id === activeId
                        ? "border-line bg-surface-2"
                        : "border-transparent hover:bg-surface-2/60"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => void openSession(s.id)}
                      className={`min-w-0 flex-1 cursor-pointer truncate text-left font-mono text-xs ${
                        s.id === activeId ? "text-fg" : "text-muted"
                      }`}
                    >
                      {s.title}
                    </button>
                    <button
                      type="button"
                      aria-label="Delete session"
                      onClick={() => void removeSession(s.id)}
                      className="cursor-pointer text-faint opacity-0 transition-opacity hover:text-bad group-hover:opacity-100"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
                {sessions.length === 0 && (
                  <p className="px-2.5 py-2 font-mono text-xs text-faint">
                    No sessions yet.
                  </p>
                )}
              </div>
            </div>
          </aside>
        )}

        <div className="mx-auto w-full max-w-3xl">
          {/* session strip — mobile */}
          {showSessions && (
            <div className="mb-4 flex items-center gap-2 overflow-x-auto pb-1 lg:hidden">
              <button
                type="button"
                onClick={newChat}
                className="flex flex-none cursor-pointer items-center gap-1 rounded-full border border-line bg-surface-2 px-3 py-1 font-mono text-xs text-muted transition-colors hover:text-fg"
              >
                <Plus size={12} />
                New
              </button>
              {sessions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => void openSession(s.id)}
                  className={`flex-none cursor-pointer rounded-full border px-3 py-1 font-mono text-xs transition-colors ${
                    s.id === activeId
                      ? "border-line-strong bg-surface-2 text-fg"
                      : "border-line text-muted hover:text-fg"
                  }`}
                >
                  {s.title.length > 24 ? `${s.title.slice(0, 23)}…` : s.title}
                </button>
              ))}
            </div>
          )}

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
                  Your conversations with {agent.name} are saved to your
                  account, so you can pick them up anytime.
                </p>
                <Button size="md" className="mt-4" onClick={signIn}>
                  Sign in
                </Button>
              </Card>
            ) : broke ? (
              <Card className="p-5 text-center">
                <p className="font-mono text-sm text-fg">Out of free credit</p>
                <p className="mx-auto mt-1 max-w-sm font-mono text-xs leading-relaxed text-muted">
                  Your welcome credit is used up. Top up with USDC to keep
                  using {agent.name}.
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
                  <Button
                    size="lg"
                    type="submit"
                    disabled={!input.trim() || sending}
                  >
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
