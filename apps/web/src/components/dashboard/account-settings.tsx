"use client";

/*
  The dashboard's Settings tab (reference: Clerk's workspace profile): the
  account identity — wallet address with copy (the "Workspace ID" of this
  product), signed-in email, holder standing, sign out.
*/

import { useState } from "react";
import { Check, Copy, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { config } from "@/lib/config";
import { formatResetDay, formatTokens } from "@/lib/format";
import { useAuth } from "@/components/auth/auth-provider";
import { TierBadge } from "@/components/token/tier-badge";
import { useTokenStanding } from "@/components/token/use-token-standing";

export function AccountSettings() {
  const { user, status, signIn, signOut } = useAuth();
  const { standing, refresh, refreshing } = useTokenStanding();
  const [copied, setCopied] = useState(false);

  if (status === "unauthenticated" || status === "disabled") {
    return (
      <Card className="mx-auto max-w-md p-6 text-center">
        <p className="font-body text-sm text-fg">Sign in to see your account</p>
        <Button size="md" className="mt-4" onClick={signIn}>
          Sign in
        </Button>
      </Card>
    );
  }

  if (!user) {
    return (
      <p className="py-16 text-center font-body text-xs text-faint">
        Loading your account…
      </p>
    );
  }

  const wallet = user.walletAddress ?? "";
  // Server standing is the truth once loaded; the client list only covers the
  // pre-load flash.
  const unmetered =
    standing?.unmetered ?? (!!wallet && config.devWallets.includes(wallet));

  async function copy() {
    if (!wallet) return;
    try {
      await navigator.clipboard.writeText(wallet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — selecting the address still works */
    }
  }

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <Card className="p-6">
        <h2 className="text-base font-semibold text-fg">Account</h2>

        {user.email && (
          <div className="mt-5">
            <p className="eyebrow mb-2">Signed in as</p>
            <p className="font-mono text-sm text-fg">{user.email}</p>
          </div>
        )}

        <div className="mt-5">
          <p className="eyebrow mb-2">Solana wallet</p>
          <p className="mb-1 font-body text-[13px] leading-relaxed text-muted">
            Your identity on the market — payments and published agents hang
            off this address.
          </p>
          <div className="mt-2 flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2.5">
            <p className="min-w-0 flex-1 select-all break-all font-mono text-xs text-fg">
              {wallet || "No wallet linked yet."}
            </p>
            {wallet && (
              <button
                type="button"
                aria-label="Copy address"
                onClick={() => void copy()}
                className="cursor-pointer text-faint transition-colors hover:text-fg"
              >
                {copied ? <Check size={13} /> : <Copy size={13} />}
              </button>
            )}
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-fg">Holder standing</h2>
          {standing && !unmetered && <TierBadge tier={standing.tier} />}
          {unmetered && (
            <span className="rounded-full border border-line bg-surface-2 px-3 py-1 font-mono text-xs text-muted">
              dev · unmetered
            </span>
          )}
        </div>
        <p className="mt-1 font-body text-[13px] leading-relaxed text-muted">
          USDC pays, $OCCA unlocks. Your free weekly messages and fee discount
          scale with how much $OCCA this wallet holds.
        </p>

        {!standing ? (
          <p className="mt-4 font-body text-xs text-faint">Reading standing…</p>
        ) : (
          <>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <div>
                <p className="eyebrow mb-1.5">Balance</p>
                <p className="font-mono text-sm text-fg">
                  {formatTokens(standing.balance)}
                  <span className="ml-1 text-xs text-faint">$OCCA</span>
                </p>
                <p className="mt-0.5 font-mono text-xs text-faint">
                  {(standing.supplyPct * 100).toFixed(3)}% of supply
                </p>
              </div>
              <div>
                <p className="eyebrow mb-1.5">Free weekly messages</p>
                <p className="font-mono text-sm text-fg">
                  {standing.tier === "none" ? (
                    "—"
                  ) : (
                    <>
                      {standing.remaining}
                      <span className="text-xs text-faint">
                        {" "}
                        / {standing.weeklyBudget} left
                      </span>
                    </>
                  )}
                </p>
                {standing.tier !== "none" && (
                  <p className="mt-0.5 font-mono text-xs text-faint">
                    resets {formatResetDay(standing.weekResetAt)}
                  </p>
                )}
              </div>
              <div>
                <p className="eyebrow mb-1.5">Fee discount</p>
                <p className="font-mono text-sm text-fg">
                  {standing.tier === "none"
                    ? "—"
                    : `${Math.round(standing.feeDiscount * 100)}%`}
                </p>
              </div>
            </div>

            {standing.tier === "none" && !unmetered && (
              <p className="mt-4 font-body text-[13px] leading-relaxed text-muted">
                You&apos;re below the 0.1% membership line — hold{" "}
                <span className="font-mono text-fg">
                  {formatTokens(standing.toMembership)}
                </span>{" "}
                more $OCCA to unlock the free weekly budget.
              </p>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={refreshing}
                onClick={() => void refresh()}
              >
                {refreshing ? "Checking…" : "Re-check balance"}
              </Button>
              <Button size="sm" href={config.occaTokenUrl} target="_blank">
                Get $OCCA
              </Button>
              {standing.checkedAt && (
                <span className="font-mono text-[0.65rem] text-faint">
                  checked {new Date(standing.checkedAt).toLocaleTimeString()}
                </span>
              )}
            </div>
          </>
        )}
      </Card>

      <div>
        <Button variant="secondary" size="sm" onClick={signOut}>
          <LogOut size={13} className="mr-1.5" />
          Sign out
        </Button>
      </div>
    </div>
  );
}
