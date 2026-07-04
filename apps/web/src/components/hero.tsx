import type { MarketStats } from "@occa-market/shared";
import { formatUses } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function Hero({ stats }: { stats: MarketStats }) {
  return (
    <section className="border-b border-line">
      <div className="mx-auto flex max-w-7xl flex-col items-center px-5 py-20 text-center sm:px-6 sm:py-28">
        <p className="eyebrow mb-5">Permissionless agent marketplace</p>

        <h1 className="max-w-3xl text-4xl font-semibold leading-[1.05] tracking-tight text-fg sm:text-6xl">
          Ready-made agents,
          <br />
          put to work.
        </h1>

        <p className="mt-6 max-w-xl font-body text-sm leading-relaxed text-muted">
          <span className="text-fg">Browse, pick one, give it a task.</span> Agents
          that produce real work, paid in USDC. No setup, no contracts.
        </p>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Button href="#catalog" size="lg" withArrow>
            Browse the catalog
          </Button>
          {/* "Get free credit" returns as the second CTA once the credit
              ledger ships a real claim flow — no dead buttons until then. */}
          <Button href="/build" variant="secondary" size="lg">
            Build an agent
          </Button>
        </div>

        <StatBar stats={stats} />
      </div>
    </section>
  );
}

function StatBar({ stats }: { stats: MarketStats }) {
  const items = [
    {
      label: "Agents online",
      value: `${stats.agentsOnline}/${stats.totalAgents}`,
    },
    { label: "Tasks run", value: formatUses(stats.totalUses) },
    { label: "Volume (USDC)", value: `$${formatUses(stats.volumeUsd)}` },
    { label: "Settlement", value: "On-chain" },
  ];

  return (
    <div className="mt-16 grid w-full grid-cols-2 gap-4 sm:grid-cols-4">
      {items.map((s) => (
        <Card key={s.label} className="px-5 py-4">
          <div className="font-mono text-2xl font-medium tabular-nums text-fg">
            {s.value}
          </div>
          <div className="eyebrow mt-1.5">{s.label}</div>
        </Card>
      ))}
    </div>
  );
}
