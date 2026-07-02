import Link from "next/link";
import { ArrowLeft, Wrench } from "lucide-react";
import type { AgentDetail as AgentDetailData, MarketAgent } from "@occa-market/shared";
import { formatUses } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SampleOutput } from "@/components/sample-output";

export function AgentDetail({
  agent,
  detail,
}: {
  agent: MarketAgent;
  detail: AgentDetailData;
}) {
  const online = agent.status === "online";

  return (
    <div className="mx-auto max-w-7xl px-5 py-10 sm:px-6">
      <Link
        href="/#catalog"
        className="inline-flex items-center gap-1.5 font-mono text-xs text-faint transition-colors hover:text-fg"
      >
        <ArrowLeft size={13} />
        back to catalog
      </Link>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr_300px]">
        {/* ── Left: identity (sticky) ─────────────────────────────── */}
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <Card className="p-6">
            <div className="spotlight mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-line text-2xl text-fg">
              {agent.glyph}
            </div>

            <div className="mt-4 text-center">
              <div className="flex items-center justify-center gap-2">
                <h1 className="text-lg font-semibold tracking-tight text-fg">
                  {agent.name}
                </h1>
                {agent.seed && (
                  <span className="rounded-full border border-line bg-surface-2 px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-wider text-faint">
                    seed
                  </span>
                )}
              </div>
              <p className="mt-1 font-mono text-xs text-faint">
                @{agent.handle}
              </p>
              <div className="mt-3 flex justify-center">
                <StatusPill online={online} />
              </div>
            </div>

            <p className="mt-4 text-center font-mono text-xs leading-relaxed text-muted">
              {agent.tagline}
            </p>

            <div className="mt-5 border-t border-line pt-5">
              <Stat label="Reputation" value={`★ ${agent.reputation}`} />
              <Stat label="Uptime" value={`${detail.uptime}%`} />
              <Stat label="Runs" value={formatUses(agent.uses)} />
              <Stat
                label="Rank"
                value={`#${detail.categoryRank} ${agent.category}`}
                accent
              />
            </div>

            <div className="mt-5 border-t border-line pt-5">
              <p className="eyebrow mb-1.5">Category</p>
              <p className="font-mono text-xs text-muted">{agent.category}</p>
            </div>

            <div className="mt-4">
              <p className="eyebrow mb-1.5">Provider</p>
              <p className="font-mono text-xs text-fg">{agent.provider}</p>
              {agent.seed && (
                <p className="mt-1 font-mono text-[0.7rem] leading-relaxed text-faint">
                  Seed agent · openly OCCA-operated
                </p>
              )}
            </div>
          </Card>
        </aside>

        {/* ── Center: content ─────────────────────────────────────── */}
        <div className="flex flex-col gap-6">
          <section>
            <p className="eyebrow mb-3">Overview</p>
            <p className="font-mono text-sm leading-relaxed text-muted">
              {detail.longDescription}
            </p>

            <p className="mt-6 mb-2 text-sm font-semibold text-fg">
              What it does
            </p>
            <ul className="flex flex-col gap-2">
              {detail.capabilities.map((cap) => (
                <li
                  key={cap}
                  className="flex gap-2.5 font-mono text-sm leading-relaxed text-muted"
                >
                  <span className="mt-2 h-1 w-1 flex-none rounded-full bg-faint" />
                  {cap}
                </li>
              ))}
            </ul>
          </section>

          <section className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <p className="eyebrow mb-3">Skills</p>
              <div className="flex flex-wrap gap-2">
                {detail.skills.map((skill) => (
                  <span
                    key={skill.name}
                    title={skill.description || undefined}
                    className="rounded-full border border-line bg-surface-2 px-3 py-1 font-mono text-xs text-muted"
                  >
                    {skill.name}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <p className="eyebrow mb-3">Tools</p>
              <div className="flex flex-wrap gap-2">
                {detail.tools.map((tool) => (
                  <span
                    key={tool}
                    className="flex items-center gap-1.5 rounded-xl border border-line bg-surface-2 px-2.5 py-1.5 font-mono text-xs text-muted"
                  >
                    <Wrench size={11} className="flex-none text-faint" />
                    {tool}
                  </span>
                ))}
              </div>
            </div>
          </section>

          <section>
            <p className="eyebrow mb-3">Workflow</p>
            <ol className="flex flex-col">
              {detail.workflow.map((step, i) => {
                const last = i === detail.workflow.length - 1;
                return (
                  <li key={i} className="flex gap-3">
                    <div className="flex flex-none flex-col items-center">
                      <span className="mt-1.5 flex h-5 w-5 flex-none items-center justify-center rounded-full border border-line-strong bg-surface-2 font-mono text-[0.6rem] text-faint">
                        {i + 1}
                      </span>
                      {!last && <span className="my-1 w-px flex-1 bg-line" />}
                    </div>
                    <p
                      className={`font-mono text-sm leading-relaxed text-muted ${
                        last ? "pb-0" : "pb-5"
                      } pt-1.5`}
                    >
                      {step}
                    </p>
                  </li>
                );
              })}
            </ol>
          </section>

          <section>
            <p className="eyebrow mb-3">Try asking</p>
            <div className="flex flex-wrap gap-2">
              {detail.examplePrompts.map((prompt) => (
                <span
                  key={prompt}
                  className="rounded-xl border border-line bg-surface-2 px-3 py-2 font-mono text-xs text-muted"
                >
                  {prompt}
                </span>
              ))}
            </div>
          </section>

          <section>
            <p className="eyebrow mb-3">Sample output</p>
            <p className="mb-2 font-mono text-xs text-faint">
              › {detail.sampleOutput.prompt}
            </p>
            <SampleOutput agent={agent} output={detail.sampleOutput} />
          </section>
        </div>

        {/* ── Right: action + activity (sticky) ───────────────────── */}
        <aside className="flex flex-col gap-6 lg:sticky lg:top-28 lg:self-start">
          <Card className="p-6">
            <div className="font-mono tabular-nums">
              <span className="text-2xl font-medium text-fg">
                ${agent.pricePerMsg.toFixed(2)}
              </span>
              <span className="ml-1.5 text-xs text-faint">USDC / msg</span>
            </div>

            {online ? (
              <Button
                size="lg"
                withArrow
                href={`/agents/${agent.id}/chat`}
                className="mt-4 w-full"
              >
                Use agent
              </Button>
            ) : (
              <Button size="lg" disabled className="mt-4 w-full">
                Offline
              </Button>
            )}

            <p className="mt-3 text-center font-mono text-[0.7rem] leading-relaxed text-faint">
              {online
                ? "Try free with your welcome credit."
                : "Agent is offline. Check back soon."}
            </p>
          </Card>

          <Card className="p-6">
            <p className="eyebrow mb-3">Live activity</p>
            <ul className="flex flex-col gap-3">
              {detail.activity.map((event, i) => (
                <li
                  key={i}
                  className="flex items-start justify-between gap-3 font-mono text-xs"
                >
                  <span className="flex gap-2 text-muted">
                    <span
                      aria-hidden
                      className="mt-1 h-1.5 w-1.5 flex-none rounded-full bg-faint"
                    />
                    {event.text}
                  </span>
                  <span className="flex-none text-faint">{event.time}</span>
                </li>
              ))}
            </ul>
          </Card>
        </aside>
      </div>

    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between py-1 font-mono text-xs">
      <span className="text-faint">{label}</span>
      <span className={accent ? "text-accent" : "text-fg"}>{value}</span>
    </div>
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