"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Plus,
  RotateCcw,
  ThumbsDown,
  ThumbsUp,
  TriangleAlert,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChatStream } from "@/components/chat-stream";
import { ShareSession } from "@/components/share-session";
import type {
  ChatMessage,
  ChatRunEvent,
  ChatSession,
  MarketAgent,
  OutputBlock,
} from "@occa-market/shared";
import {
  deleteChatSession,
  getSessionMessages,
  listChatSessions,
  rateMessage,
  sendMessage,
} from "@/lib/api";
import { config } from "@/lib/config";
import { formatResetDay, formatTokens } from "@/lib/format";
import { useAuth } from "@/components/auth/auth-provider";
import { TierBadge } from "@/components/token/tier-badge";
import { useTokenStanding } from "@/components/token/use-token-standing";
import { useCredits } from "@/components/credits/use-credits";
import { microsToUsd, paidCostMicros, usdToMicros } from "@occa-market/shared";

type Message =
  | { role: "user"; text: string }
  // id/rating ride along on stored + live replies so the thumbs can act.
  | { role: "agent"; blocks: OutputBlock[]; id?: string; rating?: 1 | -1 }
  // A failed run — client-only (failed exchanges are never persisted).
  | { role: "error"; human: string; code: string; detail?: string; retryText: string };

function fromStored(m: ChatMessage): Message {
  return m.role === "user"
    ? { role: "user", text: m.text ?? "" }
    : { role: "agent", blocks: m.blocks ?? [], id: m.id, rating: m.rating };
}

/** One row of the live "what is the agent doing" timeline. */
type ActivityStep = { label: string; state: "running" | "done" | "error" };

/** mcp__dexpaprika__getTokenPools → "dexpaprika · getTokenPools" */
function prettyTool(name?: string): string {
  if (!name) return "tool";
  if (name.startsWith("mcp__")) {
    const [server, ...rest] = name.slice(5).split("__");
    return rest.length ? `${server} · ${rest.join("__")}` : server;
  }
  return name;
}

/**
 * Map a run's machine error code to human copy. The technical detail (stderr
 * snippet, HTTP status) is shown verbatim alongside — never instead.
 */
function humanizeRunError(agentName: string, code: string): string {
  const map: Record<string, string> = {
    gateway_unreachable: `${agentName}'s gateway can't be reached right now — the provider's host looks down or unreachable from here.`,
    gateway_unauthorized: `${agentName}'s gateway refused its stored credentials. The provider needs to reconnect it.`,
    timeout: `${agentName} took too long on this one, so the run was stopped. Retry, or ask a narrower question.`,
    network_error: `The connection to ${agentName}'s model dropped mid-run. That's usually transient — retry should work.`,
    prompt_failed: `${agentName}'s process died on its gateway before it could finish the reply.`,
    provider_rate_limited: `${agentName} is at capacity right now — too many runs in a short window.`,
    stream_failed: `The reply stream broke before a result arrived.`,
    "unknown session": `This conversation no longer exists on the server — start a new chat.`,
    "unknown agent": `This agent no longer exists in the catalog.`,
    api_unreachable: `The market API can't be reached — is your connection (or the server) up?`,
  };
  return map[code] ?? `Something went wrong while running ${agentName}.`;
}

/** Append the capacity-reset hint when the server could parse one. */
function withRetryHint(human: string, code: string, retryAt?: string): string {
  if (code !== "provider_rate_limited") return human;
  if (!retryAt || Number.isNaN(Date.parse(retryAt))) {
    return `${human} It usually clears within a few hours — retry later.`;
  }
  const at = new Date(retryAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${human} Capacity frees up around ${at}.`;
}

export function AgentChat({
  agent,
  examplePrompts,
}: {
  agent: MarketAgent;
  examplePrompts: string[];
}) {
  const price = agent.pricePerMsg;

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  // Live activity while a turn runs, fed by the run's event stream.
  const [activity, setActivity] = useState<ActivityStep[]>([]);

  const { status, signIn } = useAuth();

  // Holder standing drives the meter and the gates ($OCCA tiers, token doc
  // §4). The server is authoritative — a blocked send returns fresh standing,
  // so a stale client mirror can never let a message through.
  const { standing, setStanding, refresh, refreshing } = useTokenStanding();
  const { credits, setCredits } = useCredits();
  const unmetered = standing?.unmetered ?? false;
  const gated = Boolean(standing?.enforced) && !unmetered;
  // Weekly binding beats daily in the copy — "back Monday" is the truth even
  // if today's allowance also happens to be dry.
  const weeklyDone = gated && standing!.remaining <= 0;
  const dailyDone = gated && !weeklyDone && standing!.remainingToday <= 0;
  const budgetDry = dailyDone || weeklyDone;

  // A dry budget falls through to PAID messages when the credit balance
  // covers this agent's price + fee — mirroring the server's gate order.
  const paidCostUsd = microsToUsd(
    paidCostMicros(usdToMicros(price), standing?.feeDiscount ?? 0),
  );
  const paidMode = budgetDry && (credits?.balanceUsd ?? 0) >= paidCostUsd;

  const signedOut = status === "unauthenticated" || status === "disabled";
  const blocked = budgetDry && !paidMode;
  const activeSession = sessions.find((s) => s.id === activeId) ?? null;

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
      setMessages(thread.map(fromStored));
    });
    return () => {
      active = false;
    };
  }, [status, agent.id]);

  // Grow the composer with its content (capped), shrink back when cleared.
  useEffect(() => {
    const el = composerRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  async function openSession(id: string) {
    if (id === activeId || sending) return;
    setActiveId(id);
    setMessages([]);
    const thread = await getSessionMessages(agent.id, id);
    if (thread) setMessages(thread.map(fromStored));
  }

  function newChat() {
    if (sending) return;
    setActiveId(null);
    setMessages([]);
  }

  async function removeSession(id: string) {
    if (!(await deleteChatSession(agent.id, id))) return;
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (id === activeId) newChat();
  }

  // Thumbs on an agent reply. Toggle semantics: clicking the active thumb
  // clears it. Optimistic — reverted if the server rejects.
  async function rate(index: number, messageId: string, value: 1 | -1) {
    if (!activeId) return;
    const current = messages[index];
    if (current?.role !== "agent") return;
    const next = current.rating === value ? 0 : value;
    const apply = (rating?: 1 | -1) =>
      setMessages((prev) =>
        prev.map((m, i) => (i === index && m.role === "agent" ? { ...m, rating } : m)),
      );
    apply(next === 0 ? undefined : next);
    const ok = await rateMessage(agent.id, activeId, messageId, next);
    if (!ok) apply(current.rating);
  }

  // Fold one stream event into the activity timeline: a tool starts a running
  // step, its result completes it, prose between tools shows as writing.
  function onRunEvent(event: ChatRunEvent) {
    setActivity((prev) => {
      const steps = [...prev];
      const finishRunning = (state: "done" | "error") => {
        for (let i = steps.length - 1; i >= 0; i--) {
          if (steps[i].state === "running") {
            steps[i] = { ...steps[i], state };
            break;
          }
        }
      };
      if (event.kind === "tool_use") {
        finishRunning("done");
        steps.push({ label: prettyTool(event.toolName), state: "running" });
      } else if (event.kind === "tool_result") {
        finishRunning(event.isError ? "error" : "done");
      } else if (event.kind === "assistant_text") {
        if (steps[steps.length - 1]?.label !== "writing reply") {
          finishRunning("done");
          steps.push({ label: "writing reply", state: "running" });
        }
      }
      return steps;
    });
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || blocked || sending || status !== "authenticated") return;

    setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
    setInput("");
    setSending(true);
    setActivity([]);

    const fail = (code: string, detail?: string, retryAt?: string) =>
      setMessages((prev) => [
        ...prev,
        {
          role: "error" as const,
          human: withRetryHint(humanizeRunError(agent.name, code), code, retryAt),
          code,
          detail,
          retryText: trimmed,
        },
      ]);

    try {
      const data = await sendMessage(
        agent.id,
        { message: trimmed, sessionId: activeId ?? undefined },
        onRunEvent,
      );

      if (data.ok) {
        setMessages((prev) => [
          ...prev,
          { role: "agent", blocks: data.blocks, id: data.messageId },
        ]);
        // A fresh chat just became a real session; an existing one moves to
        // the top of the list with its new activity time.
        setActiveId(data.session.id);
        setSessions((prev) => [
          data.session,
          ...prev.filter((s) => s.id !== data.session.id),
        ]);
        // Mirror the server's ledger: a paid reply moves the credit
        // balance, a free one consumes budget.
        if (data.charge) {
          const balanceUsd = data.charge.balanceUsd;
          setCredits((c) => (c ? { ...c, balanceUsd } : c));
        } else if (!unmetered) {
          setStanding((s) =>
            s
              ? {
                  ...s,
                  usedToday: s.usedToday + 1,
                  remainingToday: Math.max(0, s.remainingToday - 1),
                  usedThisWeek: s.usedThisWeek + 1,
                  remaining: Math.max(0, s.remaining - 1),
                }
              : s,
          );
        }
      } else if (
        (data.error === "hold_required" || data.error === "budget_exhausted") &&
        data.standing
      ) {
        // The holder gate said no — adopt the server's standing (which flips
        // the composer into the right card) and withdraw the optimistic
        // user message; the card is the explanation, not an error bubble.
        setStanding(data.standing);
        if (typeof data.balanceUsd === "number") {
          const balanceUsd = data.balanceUsd;
          setCredits((c) => (c ? { ...c, balanceUsd } : c));
        }
        setMessages((prev) => prev.slice(0, -1));
        setInput(trimmed);
      } else {
        fail(data.error, data.reason, data.retryAt);
      }
    } catch (err) {
      fail(
        "api_unreachable",
        err instanceof Error ? err.message : "market API fetch failed",
      );
    } finally {
      setSending(false);
      setActivity([]);
    }
  }

  const showSessions = status === "authenticated";

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 sm:px-6">
      {/* chat header — identity + holder standing. flex-wrap so the standing
          pills drop to a second row on a phone instead of squeezing the name
          into a two-line wrap. */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <Link
          href={`/agents/${agent.id}`}
          className="flex min-w-0 items-center gap-2.5 font-mono text-xs text-muted transition-colors hover:text-fg"
        >
          <ArrowLeft size={14} className="flex-none text-faint" />
          <span className="spotlight flex h-8 w-8 flex-none items-center justify-center rounded-lg border border-line text-sm text-fg">
            {agent.glyph}
          </span>
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-sm font-semibold text-fg">{agent.name}</span>
            <span className="h-1.5 w-1.5 flex-none rounded-full bg-accent" />
          </span>
        </Link>

        {!signedOut && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {activeSession && (
              <ShareSession
                agent={agent}
                session={activeSession}
                onChange={(shareId) =>
                  setSessions((prev) =>
                    prev.map((s) =>
                      s.id === activeSession.id ? { ...s, shareId } : s,
                    ),
                  )
                }
              />
            )}
            {standing && <TierBadge tier={standing.tier} />}
            {standing?.trial && !unmetered && (
              <span className="rounded-full border border-line bg-surface-2 px-2.5 py-0.5 font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">
                trial
              </span>
            )}
            {unmetered ? (
              <span className="rounded-full border border-line bg-surface-2 px-3 py-1 font-mono text-xs text-muted">
                dev · unmetered
              </span>
            ) : (
              standing && (
                <span
                  className={`rounded-full border bg-surface-2 px-3 py-1 font-mono text-xs tabular-nums ${
                    blocked ? "border-warn/30 text-warn" : "border-line text-muted"
                  }`}
                >
                  {standing.remainingToday}/{standing.dailyBudget} today ·{" "}
                  {standing.remaining}/{standing.weeklyBudget} wk
                </span>
              )
            )}
          </div>
        )}
      </div>

      {/* two columns only while the session rail is rendered — otherwise the
          chat column would fall into the 220px rail track */}
      <div
        className={`grid gap-6 ${showSessions ? "lg:grid-cols-[220px_minmax(0,1fr)]" : ""}`}
      >
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
                      className={`min-w-0 flex-1 cursor-pointer truncate text-left font-body text-xs ${
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
                  <p className="px-2.5 py-2 font-body text-xs text-faint">
                    No sessions yet.
                  </p>
                )}
              </div>
            </div>
          </aside>
        )}

        <div className="mx-auto w-full min-w-0 max-w-3xl">
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
                  className={`flex-none cursor-pointer rounded-full border px-3 py-1 font-body text-xs transition-colors ${
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
            {messages.length === 0 && !sending && (
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <span className="spotlight flex h-12 w-12 items-center justify-center rounded-2xl border border-line text-xl text-fg">
                  {agent.glyph}
                </span>
                <p className="max-w-sm font-body text-[13px] leading-relaxed text-faint">
                  {agent.tagline}
                </p>
              </div>
            )}
            {messages.map((m, i) =>
              m.role === "error" ? (
                <RunError
                  key={i}
                  message={m}
                  disabled={sending}
                  onRetry={() => void send(m.retryText)}
                />
              ) : m.role === "agent" && m.id ? (
                <div key={i}>
                  <ChatStream agent={agent} items={[m]} />
                  <Thumbs
                    value={m.rating}
                    onRate={(v) => void rate(i, m.id!, v)}
                  />
                </div>
              ) : (
                <ChatStream key={i} agent={agent} items={[m]} />
              ),
            )}
            {sending && <Typing agent={agent} activity={activity} />}
          </div>

          {/* composer / sign-in gate / top-up gate */}
          <div className="sticky bottom-4 mt-6">
            {signedOut ? (
              <Card className="p-5 text-center">
                <p className="font-body text-sm text-fg">Sign in to chat</p>
                <p className="mx-auto mt-1 max-w-sm font-body text-[13px] leading-relaxed text-muted">
                  Your conversations with {agent.name} are saved to your
                  account, so you can pick them up anytime.
                </p>
                <Button size="md" className="mt-4" onClick={signIn}>
                  Sign in
                </Button>
              </Card>
            ) : blocked ? (
              <Card className="p-5 text-center">
                <p className="font-body text-sm text-fg">
                  {weeklyDone ? "Weekly limit reached" : "Daily limit reached"}
                </p>
                <p className="mx-auto mt-1 max-w-sm font-body text-[13px] leading-relaxed text-muted">
                  {weeklyDone ? (
                    <>
                      All {standing!.weeklyBudget} free messages for this week
                      are spent. They reset{" "}
                      <span className="font-mono text-fg">
                        {formatResetDay(standing!.weekResetAt)}
                      </span>
                      .
                    </>
                  ) : (
                    <>
                      All {standing!.dailyBudget} free messages for today are
                      spent. A fresh {standing!.dailyBudget} arrive at{" "}
                      <span className="font-mono text-fg">00:00 UTC</span>.
                    </>
                  )}{" "}
                  {standing!.trial ? (
                    <>
                      Hold{" "}
                      <span className="font-mono text-fg">
                        {formatTokens(standing!.toMembership)}
                      </span>{" "}
                      more $OCCA to unlock Entry — 10 a day, 40 a week, and
                      more with higher tiers.
                    </>
                  ) : (
                    <>Holding more $OCCA raises the daily and weekly caps.</>
                  )}
                </p>
                <p className="mx-auto mt-2 max-w-sm font-body text-[13px] leading-relaxed text-muted">
                  Paid messages in USDC are{" "}
                  <span className="font-mono text-fg">coming soon</span>
                  {" — "}you&apos;ll be able to keep chatting past the free
                  budget.
                </p>
                <div className="mt-4 flex items-center justify-center gap-2">
                  <Button size="md" href={config.occaTokenUrl} target="_blank">
                    {standing!.trial ? "Get $OCCA" : "Get more $OCCA"}
                  </Button>
                  <Button
                    size="md"
                    variant="secondary"
                    disabled={refreshing}
                    onClick={() => void refresh()}
                  >
                    {refreshing ? "Checking…" : "Just bought? Re-check"}
                  </Button>
                </div>
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
                      className="cursor-pointer rounded-full border border-line bg-surface-2 px-3 py-1 font-body text-xs text-muted transition-colors hover:border-line-strong hover:text-fg disabled:opacity-50"
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
                  className="flex items-end gap-2"
                >
                  <textarea
                    ref={composerRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      // Enter sends, Shift+Enter breaks the line — the
                      // convention every chat UI has trained people on.
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        send(input);
                      }
                    }}
                    placeholder={`Ask ${agent.name}…`}
                    rows={1}
                    className="no-scrollbar max-h-40 min-h-10 flex-1 resize-none rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 font-body text-sm leading-relaxed text-fg placeholder:text-faint focus:border-line-strong focus:outline-none"
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
                  {paidMode
                    ? `$${paidCostUsd.toFixed(2)} USDC per message from your credits · $${(credits?.balanceUsd ?? 0).toFixed(2)} left`
                    : `$${price.toFixed(2)} USDC per message`}
                </p>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/*
  Buyer feedback on one reply — the rating half of the agent's reputation
  (the other half is real usage). Quiet icon pair; active thumb lifts to fg,
  a down-thumb reads as a state (bad).
*/
function Thumbs({
  value,
  onRate,
}: {
  value?: 1 | -1;
  onRate: (v: 1 | -1) => void;
}) {
  return (
    <div className="mt-1.5 flex items-center gap-1">
      <button
        type="button"
        aria-label="Good reply"
        aria-pressed={value === 1}
        onClick={() => onRate(1)}
        className={`flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border transition-colors ${
          value === 1
            ? "border-line-strong bg-surface-2 text-fg"
            : "border-transparent text-faint hover:border-line hover:text-muted"
        }`}
      >
        <ThumbsUp size={12} />
      </button>
      <button
        type="button"
        aria-label="Bad reply"
        aria-pressed={value === -1}
        onClick={() => onRate(-1)}
        className={`flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border transition-colors ${
          value === -1
            ? "border-line-strong bg-surface-2 text-bad"
            : "border-transparent text-faint hover:border-line hover:text-muted"
        }`}
      >
        <ThumbsDown size={12} />
      </button>
    </div>
  );
}

function Typing({
  agent,
  activity,
}: {
  agent: MarketAgent;
  activity: ActivityStep[];
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="spotlight flex h-8 w-8 flex-none items-center justify-center rounded-lg border border-line text-sm text-fg">
        {agent.glyph}
      </span>
      <div className="min-w-0 pt-1.5">
        <span className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="live-dot h-1.5 w-1.5 rounded-full bg-faint"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </span>

        {/* live activity timeline — what the run is actually doing right now */}
        {activity.length > 0 && (
          <ul className="mt-3 flex flex-col gap-1.5">
            {activity.map((step, i) => (
              <li
                key={i}
                className="flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 py-1.5 font-mono text-xs"
              >
                {step.state === "running" ? (
                  <span className="live-dot h-1.5 w-1.5 flex-none rounded-full bg-accent" />
                ) : step.state === "error" ? (
                  <TriangleAlert size={11} className="flex-none text-warn" />
                ) : (
                  <Check size={11} className="flex-none text-faint" />
                )}
                <span className={step.state === "running" ? "text-muted" : "text-faint"}>
                  {step.label}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/*
  A failed run, inline in the stream: what happened in plain words, the raw
  machine detail underneath (code · reason, selectable), and a retry.
*/
function RunError({
  message,
  disabled,
  onRetry,
}: {
  message: { human: string; code: string; detail?: string };
  disabled: boolean;
  onRetry: () => void;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start gap-2.5">
        <TriangleAlert size={14} className="mt-0.5 flex-none text-warn" />
        <div className="min-w-0 flex-1">
          <p className="font-body text-sm leading-relaxed text-fg">
            {message.human}
          </p>
          <p className="mt-1.5 select-all break-all font-mono text-xs leading-relaxed text-faint">
            {message.code}
            {message.detail ? ` · ${message.detail}` : ""}
          </p>
          <button
            type="button"
            disabled={disabled}
            onClick={onRetry}
            className="mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3 py-1 font-body text-xs text-muted transition-colors hover:border-line-strong hover:text-fg disabled:opacity-50"
          >
            <RotateCcw size={11} />
            Retry
          </button>
        </div>
      </div>
    </Card>
  );
}
