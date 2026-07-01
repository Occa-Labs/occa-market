"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import type { ReactNode } from "react";
import { config } from "@/lib/config";

/*
  Wraps the app in Privy's provider. When no app id is set, renders children
  straight through so the site works (sign-in just no-ops) instead of throwing.

  This is a Solana marketplace, so the wallet UI is Solana-only and every login
  provisions a Solana embedded wallet. That matters for email/social logins: the
  user has no external wallet, so `createOnLogin: "users-without-wallets"` mints
  one for them (and Privy shows its wallet UI) instead of leaving them wallet-less.
  Available login methods stay configured in the Privy dashboard.
*/
export function AppPrivyProvider({ children }: { children: ReactNode }) {
  if (!config.privyEnabled) return <>{children}</>;

  return (
    <PrivyProvider
      appId={config.privyAppId}
      config={{
        appearance: { theme: "dark", walletChainType: "solana-only" },
        embeddedWallets: {
          solana: { createOnLogin: "users-without-wallets" },
          showWalletUIs: true,
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
