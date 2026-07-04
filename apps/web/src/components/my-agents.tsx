"use client";

/*
  The provider's own shelf: every agent this account has published, with the
  paths that matter — open it in the catalog, chat with it, or jump into the
  edit wizard. Auth lives client-side (the session token), so this fetches
  after mount and gates on sign-in.
*/

import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageSquare, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { MarketAgent } from "@occa-market/shared";
import { getMyAgents } from "@/lib/api";
import { useAuth } from "@/components/auth/auth-provider";

export function MyAgents() {
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
        <p className="font-mono text-sm text-fg">Sign in to see your agents</p>
        <p className="mx-auto mt-1 max-w-sm font-mono text-xs leading-relaxed text-muted">
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
      <p className="py-16 text-center font-mono text-xs text-faint">
        Loading your agents…
      </p>
    );
  }

  if (agents.length === 0) {
    return (
      <Card className="mx-auto max-w-md p-6 text-center">
        <p className="font-mono text-sm text-fg">Nothing published yet</p>
        <p className="mx-auto mt-1 max-w-sm font-mono text-xs leading-relaxed text-muted">
          Build an agent, connect your gateway, and it shows up here.
        </p>
        <Button size="md" className="mt-4" href="/build">
          Build an agent
        </Button>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {agents.map((agent) => (
        <Card key={agent.id} className="p-5">
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href={`/agents/${agent.id}`}
              className="flex min-w-0 flex-1 items-center gap-3"
            >
              <span className="spotlight flex h-10 w-10 flex-none items-center justify-center rounded-xl border border-line text-lg text-fg">
                {agent.glyph}
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-2">
                  <span className="truncate text-base font-semibold text-fg">
                    {agent.name}
                  </span>
                  <span
                    className={`h-1.5 w-1.5 flex-none rounded-full ${
                      agent.status === "online" ? "live-dot bg-accent" : "bg-faint"
                    }`}
                  />
                </span>
                <span className="block truncate font-mono text-xs text-faint">
                  @{agent.handle} · {agent.category}
                </span>
              </span>
            </Link>

            <div className="flex flex-none items-center gap-4">
              <span className="font-mono text-xs tabular-nums text-muted">
                ${agent.pricePerMsg.toFixed(2)}
                <span className="text-faint"> / msg</span>
              </span>

              <div className="flex items-center gap-2">
                <Button size="sm" variant="secondary" href={`/agents/${agent.id}/chat`}>
                  <MessageSquare size={12} className="mr-1.5" />
                  Chat
                </Button>
                <Button size="sm" href={`/agents/${agent.id}/edit`}>
                  <Pencil size={12} className="mr-1.5" />
                  Edit
                </Button>
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
