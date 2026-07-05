/*
  Market-wide run history — one row per agent run (reply), newest first.
  Metadata only: time, agent, buyer thumbs, and whether the run's day root
  is already anchored on-chain. Chat content stays inside its session.
*/

import Link from "next/link";
import { getRunHistory } from "@/lib/api";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { RunHistoryEntry } from "@occa-market/shared";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "History · OCCA Open Market",
  description: "Every agent run across the market, with its on-chain anchor status.",
};

function utcTime(iso: string): string {
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)}`;
}

function shortSig(sig: string): string {
  return `${sig.slice(0, 4)}…${sig.slice(-4)}`;
}

function Rating({ value }: { value: number }) {
  if (value > 0) return <span className="text-fg">+1</span>;
  if (value < 0) return <span className="text-muted">−1</span>;
  return <span className="text-faint">—</span>;
}

function AnchorStatus({ run, cluster }: { run: RunHistoryEntry; cluster: string }) {
  if (run.anchored && run.txSig) {
    return (
      <a
        href={`https://explorer.solana.com/tx/${run.txSig}?cluster=${cluster}`}
        target="_blank"
        rel="noreferrer"
        className="text-link"
        title={run.txSig}
      >
        {shortSig(run.txSig)}
      </a>
    );
  }
  return <span className="text-faint">pending</span>;
}

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ before?: string }>;
}) {
  const { before } = await searchParams;
  const { runs, stats, cluster, nextBefore } = await getRunHistory(before);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-5 py-10 sm:px-6">
        <p className="eyebrow mb-3">Market history</p>
        <h1 className="text-2xl font-semibold tracking-tight text-fg">
          Every run, on the record
        </h1>
        <p className="mt-2 max-w-xl font-body text-sm leading-relaxed text-muted">
          Each agent reply lands here the moment it happens. Once its UTC day
          closes, the day&apos;s runs and ratings are committed to Solana as one
          Merkle root — the row flips from pending to its transaction.
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          <StatChip label="runs recorded" value={stats.totalRuns} />
          <StatChip label="days anchored" value={stats.anchoredDays} />
          <StatChip label="agents on-chain" value={stats.onchainAgents} />
        </div>

        <Card className="mt-6 p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse font-mono text-xs">
              <thead>
                <tr className="text-left text-faint">
                  <th className="px-5 py-3 font-normal uppercase tracking-[0.18em] text-[0.6rem]">
                    Time (UTC)
                  </th>
                  <th className="px-5 py-3 font-normal uppercase tracking-[0.18em] text-[0.6rem]">
                    Agent
                  </th>
                  <th className="px-5 py-3 font-normal uppercase tracking-[0.18em] text-[0.6rem]">
                    Rating
                  </th>
                  <th className="px-5 py-3 font-normal uppercase tracking-[0.18em] text-[0.6rem]">
                    Provenance
                  </th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id} className="border-t border-line">
                    <td className="px-5 py-3 tabular-nums text-muted">
                      {utcTime(run.createdAt)}
                    </td>
                    <td className="px-5 py-3">
                      <Link
                        href={`/agents/${run.agent.id}`}
                        className="inline-flex items-center gap-2 text-fg transition-colors hover:text-accent"
                      >
                        <span className="flex h-5 w-5 items-center justify-center rounded-md border border-line bg-surface-2 text-[0.6rem]">
                          {run.agent.glyph}
                        </span>
                        {run.agent.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <Rating value={run.rating} />
                    </td>
                    <td className="px-5 py-3">
                      <AnchorStatus run={run} cluster={cluster} />
                    </td>
                  </tr>
                ))}
                {runs.length === 0 && (
                  <tr className="border-t border-line">
                    <td colSpan={4} className="px-5 py-10 text-center">
                      <span className="font-body text-sm text-faint">
                        No runs {before ? "past this point" : "yet"} — history
                        starts with the first agent reply.
                      </span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="mt-5 flex items-center gap-3">
          {before && (
            <Button size="sm" variant="secondary" href="/history">
              Back to latest
            </Button>
          )}
          {nextBefore && (
            <Button
              size="sm"
              variant="secondary"
              href={`/history?before=${encodeURIComponent(nextBefore)}`}
            >
              Older runs
            </Button>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function StatChip({ label, value }: { label: string; value: number }) {
  return (
    <span className="flex items-baseline gap-1.5 rounded-xl border border-line bg-surface-2 px-3 py-1.5 font-mono text-xs">
      <span className="tabular-nums text-fg">{value}</span>
      <span className="text-faint">{label}</span>
    </span>
  );
}
