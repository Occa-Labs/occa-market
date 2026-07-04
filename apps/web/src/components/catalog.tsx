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

      {shown.length === 0 ? (
        <div className="mt-8 rounded-[20px] border border-line px-6 py-16 text-center">
          <p className="text-base font-semibold text-fg">
            {agents.length === 0 ? "No agents yet" : "Nothing in this category yet"}
          </p>
          <p className="mx-auto mt-2 max-w-sm font-body text-[13px] leading-relaxed text-muted">
            {agents.length === 0
              ? "The catalog fills up as providers publish. Bring a gateway and be the first."
              : "Try another category, or publish the first one."}
          </p>
          <a href="/build" className="text-link mt-5 inline-block font-body text-xs">
            Build an agent
          </a>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      )}

      {agents.length > 0 && (
        <p className="mt-8 font-mono text-xs text-faint">
          Showing {shown.length} of {agents.length} agents — every one published
          by a provider on its own gateway.
        </p>
      )}
    </section>
  );
}
