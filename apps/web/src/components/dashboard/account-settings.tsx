"use client";

/*
  The dashboard's Settings tab (reference: Clerk's workspace profile): the
  account identity — wallet address with copy (the "Workspace ID" of this
  product), signed-in email, credit standing, sign out.
*/

import { useState } from "react";
import { Check, Copy, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { config } from "@/lib/config";
import { useAuth } from "@/components/auth/auth-provider";

export function AccountSettings() {
  const { user, status, signIn, signOut } = useAuth();
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
  const unmetered = !!wallet && config.devWallets.includes(wallet);

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
        <h2 className="text-base font-semibold text-fg">Credit</h2>
        <p className="mt-1 font-body text-[13px] leading-relaxed text-muted">
          Chat is metered per message in USDC.
        </p>
        <p className="mt-4 font-mono text-sm text-fg">
          {unmetered ? (
            <span className="rounded-full border border-line bg-surface-2 px-3 py-1 text-xs text-muted">
              dev · unmetered
            </span>
          ) : (
            <>
              ${config.welcomeCredit.toFixed(2)}
              <span className="ml-1.5 text-xs text-faint">welcome credit</span>
            </>
          )}
        </p>
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
