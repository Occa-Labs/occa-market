"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import type { ReactNode } from "react";
import { config } from "@/lib/config";

/*
  Wraps the app in Privy's provider. When no app id is set, renders children
  straight through so the site works (sign-in just no-ops) instead of throwing.
  Login methods + embedded Solana wallets are configured in the Privy dashboard.
*/
export function AppPrivyProvider({ children }: { children: ReactNode }) {
  if (!config.privyEnabled) return <>{children}</>;

  return (
    <PrivyProvider
      appId={config.privyAppId}
      config={{ appearance: { theme: "dark" } }}
    >
      {children}
    </PrivyProvider>
  );
}
