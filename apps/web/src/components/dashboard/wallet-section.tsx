"use client";

/*
  The dashboard's Wallet section: spendable USDC in the provider's wallet plus
  their settlement earnings summed across every agent they own. Read-only — the
  per-agent Claim button lives on the Agents tab. Balances read live on-chain.
*/

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import type { WalletActivityEntry, WalletSummary } from "@occa-market/shared";
import { Card } from "@/components/ui/card";
import { getWallet, getWalletHistory } from "@/lib/api";

const explorerTx = (sig: string, cluster: string) =>
  `https://explorer.solana.com/tx/${sig}?cluster=${cluster}`;

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function WalletSection() {
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [activity, setActivity] = useState<WalletActivityEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    void Promise.all([getWallet(), getWalletHistory()]).then(([w, a]) => {
      if (!active) return;
      setWallet(w);
      setActivity(a);
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!loaded) {
    return (
      <p className="py-16 text-center font-body text-xs text-faint">
        Reading your wallet…
      </p>
    );
  }

  const earnings = wallet?.earnings;

  return (
    <>
      {/* Spendable — what the wallet can pay with. */}
      <Card className="p-2">
        <div className="px-5 pb-1 pt-4">
          <h3 className="text-base font-semibold tracking-tight text-fg">
            Spendable
          </h3>
        </div>
        <p className="px-5 pb-4 font-body text-[13px] leading-relaxed text-muted">
          USDC held in your wallet, for paying agents and topping up credits.
        </p>
        <div className="rounded-xl border border-line bg-surface-2/50 p-6">
          <p className="eyebrow mb-1.5">USDC balance</p>
          <p className="font-mono text-2xl tabular-nums text-fg">
            ${wallet?.spendableUsdcUsd.toFixed(2) ?? "0.00"}
            <span className="ml-2 text-sm text-faint">USDC</span>
          </p>
        </div>
      </Card>

      {/* Earnings — settlement money across every agent they own. */}
      <Card className="p-2">
        <div className="px-5 pb-1 pt-4">
          <h3 className="text-base font-semibold tracking-tight text-fg">
            Earnings
          </h3>
        </div>
        <p className="px-5 pb-4 font-body text-[13px] leading-relaxed text-muted">
          What your agents have earned into their on-chain vaults. Claim each
          agent from the{" "}
          <Link href="/dashboard" className="text-link">
            Agents
          </Link>{" "}
          tab.
        </p>
        <div className="grid gap-4 rounded-xl border border-line bg-surface-2/50 p-6 sm:grid-cols-3">
          <div>
            <p className="eyebrow mb-1.5">Ready to claim</p>
            <p className="font-mono text-xl tabular-nums text-fg">
              ${earnings?.claimableUsd.toFixed(2) ?? "0.00"}
            </p>
          </div>
          <div>
            <p className="eyebrow mb-1.5">Claimed to date</p>
            <p className="font-mono text-xl tabular-nums text-fg">
              ${earnings?.claimedUsd.toFixed(2) ?? "0.00"}
            </p>
          </div>
          <div>
            <p className="eyebrow mb-1.5">Agents with a vault</p>
            <p className="font-mono text-xl tabular-nums text-fg">
              {earnings?.agents ?? 0}
            </p>
          </div>
        </div>
      </Card>

      {/* Recent activity — payments in + claims out, newest first. */}
      <Card className="p-2">
        <div className="px-5 pb-1 pt-4">
          <h3 className="text-base font-semibold tracking-tight text-fg">
            Recent activity
          </h3>
        </div>
        <p className="px-5 pb-4 font-body text-[13px] leading-relaxed text-muted">
          Payments your agents received and claims you've made. Each links to
          the transaction on-chain.
        </p>
        {activity.length === 0 ? (
          <div className="rounded-xl border border-line bg-surface-2/50 p-6">
            <p className="font-body text-xs text-faint">No activity yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface-2/50">
            {activity.map((e, i) => {
              const incoming = e.kind === "payment";
              return (
                <div key={`${e.txSig}-${i}`} className="flex items-center gap-3 px-4 py-3">
                  <span
                    className={`flex h-7 w-7 flex-none items-center justify-center rounded-lg border border-line ${
                      incoming ? "text-accent" : "text-fg"
                    }`}
                  >
                    {incoming ? <ArrowDownLeft size={13} /> : <ArrowUpRight size={13} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-body text-[13px] text-fg">
                      {incoming ? "Payment" : "Claim"}
                      <span className="text-muted"> · {e.agentName}</span>
                    </p>
                    <p className="font-mono text-[11px] text-faint">{relativeTime(e.at)}</p>
                  </div>
                  <span className="font-mono text-sm tabular-nums text-fg">
                    ${e.amountUsd.toFixed(2)}
                  </span>
                  {e.txSig && (
                    <a
                      href={explorerTx(e.txSig, e.cluster)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-link font-mono text-[11px]"
                    >
                      tx
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </>
  );
}
