"use client";

import { useState } from "react";
import { AlertTriangle, Check, X } from "lucide-react";
import {
  SCAN_COUNTS,
  SCAN_WINDOWS,
  type LaunchItem,
  type ScanWindow,
  type SignalStatus,
} from "@occa-market/shared";

const SIGNAL_ICON = { ok: Check, warn: AlertTriangle, bad: X } as const;
const SIGNAL_COLOR: Record<SignalStatus, string> = {
  ok: "text-faint",
  warn: "text-warn",
  bad: "text-bad",
};

/* The launchScan block — a new-pair scan with a selectable look-back window.
   The token list filters to whatever launched inside the chosen window. */
export function LaunchScan({ launches }: { launches: LaunchItem[] }) {
  const [win, setWin] = useState<ScanWindow>(24);
  const shown = launches.filter((l) => l.ageHours <= win);

  return (
    <div className="flex flex-col gap-3">
      {/* look-back window selector */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[0.6rem] uppercase tracking-wider text-faint">
          Window
        </span>
        {SCAN_WINDOWS.map((w) => {
          const active = w === win;
          return (
            <button
              key={w}
              type="button"
              onClick={() => setWin(w)}
              className={`cursor-pointer rounded-full border px-2.5 py-1 font-mono text-xs transition-colors ${
                active
                  ? "border-fg/25 bg-surface-2 text-fg"
                  : "border-line text-muted hover:border-line-strong hover:text-fg"
              }`}
            >
              {w}h
            </button>
          );
        })}
      </div>

      <p className="font-mono text-xs text-faint">
        Scanned {SCAN_COUNTS[win].toLocaleString()} new pairs in the last {win}h
        · {shown.length} worth a look
      </p>

      <ul className="flex flex-col gap-2">
        {shown.map((launch) => (
          <LaunchRow key={launch.ticker} launch={launch} />
        ))}
      </ul>
    </div>
  );
}

function LaunchRow({ launch }: { launch: LaunchItem }) {
  const Icon = SIGNAL_ICON[launch.status];
  return (
    <li className="flex items-start gap-2.5 rounded-xl border border-line bg-surface-2 px-3 py-2.5 font-mono text-xs">
      <Icon
        size={13}
        className={`mt-0.5 flex-none ${SIGNAL_COLOR[launch.status]}`}
      />
      <div className="flex flex-1 flex-col gap-0.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-medium text-fg">{launch.ticker}</span>
          <span className="flex-none tabular-nums text-faint">
            {launch.age} · {launch.liquidity}
          </span>
        </div>
        <span className="text-muted">{launch.note}</span>
      </div>
    </li>
  );
}
