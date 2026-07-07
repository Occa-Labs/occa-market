import { AlertTriangle, Check, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { AgentChart } from "@/components/agent-chart";
import { LaunchScan } from "@/components/launch-scan";
import { MarkdownText } from "@/components/markdown-text";
import {
  type MarketAgent,
  type OutputBlock,
  type SampleSignal,
  type SignalStatus,
  type SampleOutput as SampleOutputData,
} from "@occa-market/shared";

/*
  Renders an agent reply as a list of typed blocks (see OutputBlock).
  The switch in <Block> is the only place that maps a block type to UI, so
  adding a new output shape means adding one case here — every agent that
  emits that block gets it for free. Interactive blocks (launchScan) are
  client islands; the rest render on the server.
*/

const SIGNAL_ICON = { ok: Check, warn: AlertTriangle, bad: X } as const;
const SIGNAL_COLOR: Record<SignalStatus, string> = {
  ok: "text-faint",
  warn: "text-warn",
  bad: "text-bad",
};

export function SampleOutput({
  agent,
  output,
}: {
  agent: MarketAgent;
  output: SampleOutputData;
}) {
  // a leading verdict block rides in the header; the rest flow in the body
  const verdict = output.blocks.find((b) => b.type === "verdict");
  const body = output.blocks.filter((b) => b.type !== "verdict");

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="spotlight flex h-8 w-8 flex-none items-center justify-center rounded-lg border border-line text-sm text-fg">
            {agent.glyph}
          </span>
          <span className="text-sm font-semibold text-fg">{agent.name}</span>
        </div>
        {verdict?.type === "verdict" && (
          <VerdictBadge verdict={verdict.label} level={verdict.level} />
        )}
      </div>

      <div className="mt-4 flex flex-col gap-4">
        {body.map((block, i) => (
          <Block key={i} block={block} />
        ))}
      </div>
    </Card>
  );
}

function Block({ block }: { block: OutputBlock }) {
  switch (block.type) {
    case "summary":
      // Model-authored text arrives as markdown; render it, don't show it raw.
      return <MarkdownText text={block.text} />;

    case "metrics":
      return (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {block.items.map((m) => (
            <div
              key={m.label}
              className="rounded-xl border border-line bg-surface-2 px-3 py-2.5"
            >
              <p className="font-mono text-[0.6rem] uppercase tracking-wider text-faint">
                {m.label}
              </p>
              <p className="mt-0.5 font-mono text-sm tabular-nums text-fg">
                {m.value}
              </p>
            </div>
          ))}
        </div>
      );

    case "signals":
      return (
        <div>
          <p className="eyebrow mb-2.5">Checks</p>
          <ul className="flex flex-col gap-2">
            {block.items.map((signal, i) => (
              <SignalRow key={i} signal={signal} />
            ))}
          </ul>
        </div>
      );

    case "launchScan":
      return <LaunchScan launches={block.launches} />;

    case "chart":
      return <AgentChart candles={block.candles} interval={block.interval} />;

    case "thread":
      return (
        <ol className="flex flex-col">
          {block.posts.map((post, i) => {
            const last = i === block.posts.length - 1;
            return (
              <li key={i} className="flex gap-3">
                <div className="flex flex-none flex-col items-center">
                  <span className="mt-1.5 h-2 w-2 flex-none rounded-full border border-line-strong bg-surface-2" />
                  {!last && <span className="my-1 w-px flex-1 bg-line" />}
                </div>
                <div className="mb-2 flex-1 rounded-xl border border-line bg-surface-2 px-3.5 py-2.5">
                  <p className="font-mono text-xs leading-relaxed text-muted">
                    {post}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      );

    case "verdict":
      return null; // handled in the header

    default:
      return null;
  }
}

function VerdictBadge({
  verdict,
  level,
}: {
  verdict: string;
  level: SignalStatus;
}) {
  const styles: Record<SignalStatus, string> = {
    ok: "border-line bg-surface-2 text-muted",
    warn: "border-warn/30 bg-warn/10 text-warn",
    bad: "border-bad/30 bg-bad/10 text-bad",
  };
  const Icon = SIGNAL_ICON[level];
  return (
    <span
      className={`flex flex-none items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-xs ${styles[level]}`}
    >
      <Icon size={12} />
      {verdict}
    </span>
  );
}

function SignalRow({ signal }: { signal: SampleSignal }) {
  const Icon = SIGNAL_ICON[signal.status];
  return (
    <li className="flex items-start gap-2 font-mono text-xs">
      <Icon
        size={13}
        className={`mt-0.5 flex-none ${SIGNAL_COLOR[signal.status]}`}
      />
      <span
        className={signal.status === "ok" ? "text-muted" : SIGNAL_COLOR[signal.status]}
      >
        {signal.label}
      </span>
    </li>
  );
}
