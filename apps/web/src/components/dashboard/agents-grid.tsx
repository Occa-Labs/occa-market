"use client";

/*
  The dashboard's Agents tab (reference: Clerk's Applications grid): a dashed
  create tile plus a card per published agent — identity up top, status badge,
  quick paths to chat and the edit wizard.
*/

import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageSquare, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { MarketAgent } from "@occa-market/shared";
import { getMyAgents } from "@/lib/api";
import { useAuth } from "@/components/auth/auth-provider";

export function AgentsGrid() {
  const { status, signIn } = useAuth();
  const [agents, setAgents] = useState<MarketAgent[] | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    let active = true;
    void getMyAgents().then((list) => {
      if (active) setAgents(list ?? []);
    });
    return () => {
      active = false;
    };
  }, [status]);

  if (status === "unauthenticated" || status === "disabled") {
    return (
      <Card className="mx-auto max-w-md p-6 text-center">
        <p className="font-body text-sm text-fg">Sign in to open your dashboard</p>
        <p className="mx-auto mt-1 max-w-sm font-body text-[13px] leading-relaxed text-muted">
          The agents you publish are tied to your account.
        </p>
        <Button size="md" className="mt-4" onClick={signIn}>
          Sign in
        </Button>
      </Card>
    );
  }

  if (agents === null) {
    return (
      <p className="py-16 text-center font-body text-xs text-faint">
        Loading your agents…
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {/* create tile — dashed, quiet, always first */}
      <Link
        href="/build"
        className="flex min-h-[220px] items-center justify-center rounded-[20px] border border-dashed border-line-strong font-body text-sm text-muted transition-colors hover:border-white/25 hover:text-fg"
      >
        <span className="flex items-center gap-2">
          <Plus size={15} />
          Create agent
        </span>
      </Link>

      {agents.map((agent) => (
        <Card key={agent.id} className="flex min-h-[220px] flex-col p-0">
          {/* header zone — glyph + handle in machine voice */}
          <Link
            href={`/agents/${agent.id}`}
            className="flex items-start justify-between gap-3 border-b border-line bg-bg/40 px-5 py-5"
          >
            <span className="spotlight flex h-9 w-9 flex-none items-center justify-center rounded-lg border border-line text-base text-fg">
              {agent.glyph}
            </span>
            <span className="truncate pt-2 font-mono text-xs text-faint">
              @{agent.handle}
            </span>
          </Link>

          <div className="flex flex-1 flex-col px-5 py-4">
            <Link
              href={`/agents/${agent.id}`}
              className="text-base font-semibold text-fg transition-colors hover:text-fg"
            >
              {agent.name}
            </Link>

            <span
              className={`mt-2 inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-xs ${
                agent.status === "online"
                  ? "border-line text-muted"
                  : "border-dashed border-line-strong text-faint"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  agent.status === "online" ? "live-dot bg-accent" : "bg-faint"
                }`}
              />
              {agent.status === "online" ? "Online" : "Offline"}
            </span>

            <div className="mt-auto flex items-center justify-between pt-4">
              <span className="font-mono text-xs tabular-nums text-faint">
                ${agent.pricePerMsg.toFixed(2)} / msg · {agent.uses} uses
              </span>
              <span className="flex items-center gap-1.5">
                <Button size="sm" variant="secondary" href={`/agents/${agent.id}/chat`}>
                  <MessageSquare size={12} />
                </Button>
                <Button size="sm" variant="secondary" href={`/agents/${agent.id}/edit`}>
                  <Pencil size={12} />
                </Button>
              </span>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
