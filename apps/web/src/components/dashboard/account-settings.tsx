"use client";

/*
  The dashboard's Settings tab (reference: Clerk's workspace settings page):
  a grouped sidebar on the left switching between sections — each sidebar
  item shows only its own section, like Clerk's Settings / Plan / Usage
  pages. Section cards hold an inset panel of rows: label, muted
  description, control.
*/

import { useState } from "react";
import { Check, Coins, Copy, LogOut, Settings as SettingsIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { config } from "@/lib/config";
import { formatResetDay, formatTokens } from "@/lib/format";
import { useAuth } from "@/components/auth/auth-provider";
import { TierBadge } from "@/components/token/tier-badge";
import { useTokenStanding } from "@/components/token/use-token-standing";

type SectionKey = "account" | "standing";

const NAV_GROUPS: {
  label: string;
  labelClass?: string;
  items: { key: SectionKey; label: string; icon: typeof SettingsIcon }[];
}[] = [
  {
    label: "Account",
    items: [{ key: "account", label: "Settings", icon: SettingsIcon }],
  },
  {
    label: "$OCCA",
    labelClass: "font-mono",
    items: [{ key: "standing", label: "Holder standing", icon: Coins }],
  },
];

const SECTION_TITLES: Record<SectionKey, string> = {
  account: "Settings",
  standing: "Holder standing",
};

export function AccountSettings() {
  const { user, status, signIn, signOut } = useAuth();
  const { standing, refresh, refreshing } = useTokenStanding();
  const [copied, setCopied] = useState(false);
  const [active, setActive] = useState<SectionKey>("account");

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

  const accountSection = (
    <>
      <Card className="p-2">
        <div className="px-5 pb-4 pt-4">
          <h3 className="text-base font-semibold tracking-tight text-fg">
            Account profile
          </h3>
        </div>

        <div className="divide-y divide-line rounded-xl border border-line bg-surface-2/50">
          {user.email && (
            <div className="p-6">
              <p className="text-[15px] font-semibold text-fg">Signed in as</p>
              <p className="mt-3 font-mono text-sm text-fg">{user.email}</p>
            </div>
          )}

          <div className="p-6">
            <p className="text-[15px] font-semibold text-fg">Solana wallet</p>
            <p className="mt-1 font-body text-[13px] leading-relaxed text-muted">
              Your identity on the market — payments and published agents hang
              off this address.
            </p>
            <div className="mt-3 flex max-w-lg items-center gap-2 rounded-xl border border-line-strong bg-surface-2 px-3.5 py-2.5">
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
        </div>
      </Card>

      <div>
        <Button variant="secondary" size="sm" onClick={signOut}>
          <LogOut size={13} className="mr-1.5" />
          Sign out
        </Button>
      </div>
    </>
  );

  const standingSection = (
    <Card className="p-2">
      <div className="flex items-center justify-between gap-3 px-5 pt-4">
        <h3 className="text-base font-semibold tracking-tight text-fg">
          Holder standing
        </h3>
        {standing && !unmetered && <TierBadge tier={standing.tier} />}
        {standing?.trial && !unmetered && (
          <span className="rounded-full border border-line bg-surface-2 px-2.5 py-0.5 font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">
            trial
          </span>
        )}
        {unmetered && (
          <span className="rounded-full border border-line bg-surface-2 px-3 py-1 font-mono text-xs text-muted">
            dev · unmetered
          </span>
        )}
      </div>
      <p className="px-5 pb-4 pt-1 font-body text-[13px] leading-relaxed text-muted">
        USDC pays, $OCCA unlocks. Your free daily and weekly messages and fee
        discount scale with how much $OCCA this wallet holds.
      </p>

      {!standing ? (
        <p className="px-5 pb-4 font-body text-xs text-faint">
          Reading standing…
        </p>
      ) : (
        <>
          <div className="divide-y divide-line rounded-xl border border-line bg-surface-2/50">
            <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4">
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
                <p className="eyebrow mb-1.5">Today</p>
                <p className="font-mono text-sm text-fg">
                  {standing.remainingToday}
                  <span className="text-xs text-faint">
                    {" "}
                    / {standing.dailyBudget} left
                  </span>
                </p>
                <p className="mt-0.5 font-mono text-xs text-faint">
                  resets 00:00 UTC
                </p>
              </div>
              <div>
                <p className="eyebrow mb-1.5">This week</p>
                <p className="font-mono text-sm text-fg">
                  {standing.remaining}
                  <span className="text-xs text-faint">
                    {" "}
                    / {standing.weeklyBudget} left
                  </span>
                </p>
                <p className="mt-0.5 font-mono text-xs text-faint">
                  resets {formatResetDay(standing.weekResetAt)}
                </p>
              </div>
              <div>
                <p className="eyebrow mb-1.5">Fee discount</p>
                <p className="font-mono text-sm text-fg">
                  {standing.trial
                    ? "—"
                    : `${Math.round(standing.feeDiscount * 100)}%`}
                </p>
              </div>
            </div>

            {standing.trial && !unmetered && (
              <p className="p-6 font-body text-[13px] leading-relaxed text-muted">
                You&apos;re on the free trial — {standing.dailyBudget} messages
                a day, {standing.weeklyBudget} a week. Hold{" "}
                <span className="font-mono text-fg">
                  {formatTokens(standing.toMembership)}
                </span>{" "}
                more $OCCA to unlock Entry: 10 a day, 40 a week, plus a fee
                discount.
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 px-5 pb-3 pt-4">
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
  );

  return (
    <div className="grid gap-10 lg:grid-cols-[250px_minmax(0,1fr)]">
      {/* section nav — grouped like Clerk's Workspace / Billing sidebar */}
      <aside className="hidden self-start lg:sticky lg:top-24 lg:block">
        <nav className="flex flex-col gap-8">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p
                className={`mb-2.5 px-3 text-[13px] font-medium text-faint ${group.labelClass ?? ""}`}
              >
                {group.label}
              </p>
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setActive(item.key)}
                    className={`flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                      active === item.key
                        ? "bg-surface-2 text-fg"
                        : "text-muted hover:text-fg"
                    }`}
                  >
                    <item.icon size={16} className="shrink-0 text-faint" />
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      <div className="min-w-0">
        {/* mobile fallback for the sidebar — same sections as pills */}
        <div className="mb-6 flex gap-2 lg:hidden">
          {NAV_GROUPS.flatMap((group) => group.items).map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setActive(item.key)}
              className={`cursor-pointer rounded-lg px-3 py-2 text-sm transition-colors ${
                active === item.key
                  ? "bg-surface-2 text-fg"
                  : "text-muted hover:text-fg"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="border-b border-line pb-6">
          <h2 className="text-3xl font-semibold tracking-tight text-fg">
            {SECTION_TITLES[active]}
          </h2>
        </div>

        <div className="mt-10 flex flex-col gap-8">
          {active === "account" ? accountSection : standingSection}
        </div>
      </div>
    </div>
  );
}
