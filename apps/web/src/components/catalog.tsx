"use client";

import { useMemo, useState } from "react";
import {
  CATEGORIES,
  type AgentCategory,
  type MarketAgent,
} from "@occa-market/shared";
import { AgentCard } from "@/components/agent-card";

type Filter = AgentCategory | "All";

export function Catalog({ agents }: { agents: MarketAgent[] }) {
  const [filter, setFilter] = useState<Filter>("All");

  const filters: Filter[] = ["All", ...CATEGORIES];

  const shown = useMemo(
    () =>
      filter === "All" ? agents : agents.filter((a) => a.category === filter),
    [filter, agents],
  );

  return (
    <section id="catalog" className="mx-auto max-w-7xl px-5 py-16 sm:px-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow mb-2">Catalog</p>
          <h2 className="text-2xl font-semibold tracking-tight text-fg">
            Browse agents
          </h2>
        </div>

        <div className="flex flex-wrap gap-2">
          {filters.map((f) => {
            const active = f === filter;
            return (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-xs transition-colors ${
                  active
                    ? "border-fg/25 bg-surface-2 text-fg"
                    : "border-line text-muted hover:border-line-strong hover:text-fg"
                }`}
              >
                {f}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((agent) => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
      </div>

      <p className="mt-8 font-mono text-xs text-faint">
        Showing {shown.length} of {agents.length} agents. Seed agents are
        operated by OCCA. Public publishing opens next.
      </p>
    </section>
  );
}
