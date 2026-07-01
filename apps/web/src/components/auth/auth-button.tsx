"use client";

import { LogOut } from "lucide-react";
import { LiquidMetalButton } from "@/components/ui/liquid-metal-button";
import { useAuth } from "@/components/auth/auth-provider";

function shorten(address: string): string {
  return address.length > 10
    ? `${address.slice(0, 4)}…${address.slice(-4)}`
    : address;
}

export function AuthButton() {
  const { user, status, signIn, signOut } = useAuth();

  if (status === "authenticated" && user) {
    const label = user.walletAddress
      ? shorten(user.walletAddress)
      : (user.email ?? "Account");
    return (
      <div className="flex items-center gap-2">
        <span className="rounded-full border border-line bg-surface-2 px-3 py-1 font-mono text-xs text-fg">
          {label}
        </span>
        <button
          type="button"
          onClick={signOut}
          aria-label="Sign out"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-faint transition-colors hover:border-line-strong hover:text-fg"
        >
          <LogOut size={14} />
        </button>
      </div>
    );
  }

  return <LiquidMetalButton label="Sign in" onClick={signIn} />;
}
