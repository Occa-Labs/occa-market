import Link from "next/link";
import type { MarketAgent } from "@occa-market/shared";
import { formatUses } from "@/lib/format";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function AgentCard({ agent }: { agent: MarketAgent }) {
  const online = agent.status === "online";
  const comingSoon = !agent.available;
  const href = `/agents/${agent.id}`;

  return (
    <Card
      className={`group relative flex flex-col p-6 transition-all ${
        comingSoon ? "" : "cursor-pointer"
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="spotlight flex h-12 w-12 items-center justify-center rounded-xl border border-line text-xl text-fg">
          {agent.glyph}
        </div>
        {!comingSoon && <StatusPill online={online} />}
      </div>

      <div className="mt-5">
        <div className="flex items-center gap-2">
          <CardTitle
            className={comingSoon ? "" : "transition-colors group-hover:text-accent"}
          >
            {agent.name}
          </CardTitle>
          {comingSoon && (
            <span className="rounded-full border border-line-strong bg-surface-2 px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-wider text-fg">
              soon
            </span>
          )}
        </div>
        <p className="mt-1 font-mono text-xs text-faint">@{agent.handle}</p>
      </div>

      <CardDescription className="mt-3 flex-1">{agent.tagline}</CardDescription>

      <div className="mt-5 flex items-center gap-2 font-mono text-xs text-faint">
        <span className="rounded-full border border-line bg-surface-2 px-2 py-0.5">
          {agent.category}
        </span>
        <span title="reputation">★ {agent.reputation}</span>
        <span title="tasks run">{formatUses(agent.uses)} runs</span>
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-line pt-5">
        <div className="font-mono tabular-nums">
          <span className="text-sm font-medium text-fg">
            ${agent.pricePerMsg.toFixed(2)}
          </span>
          <span className="ml-1.5 text-xs text-faint">USDC / msg</span>
        </div>
        {comingSoon ? (
          <Button size="sm" disabled>
            Soon
          </Button>
        ) : (
          <Button size="sm" variant="secondary" href={href} className="relative z-10">
            View
          </Button>
        )}
      </div>

      {/* whole-card link (stretched), kept below the View button's z-layer */}
      {!comingSoon && (
        <Link
          href={href}
          aria-label={`View ${agent.name}`}
          className="absolute inset-0 z-0"
        />
      )}
    </Card>
  );
}

function StatusPill({ online }: { online: boolean }) {
  return (
    <span className="flex items-center gap-1.5 font-mono text-xs">
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          online ? "live-dot bg-accent" : "bg-faint"
        }`}
      />
      <span className={online ? "text-accent" : "text-faint"}>
        {online ? "online" : "offline"}
      </span>
    </span>
  );
}
