"use client";

/*
  Read-only settlement earnings for one agent on its dashboard card. x402
  payments accrue in the agent's on-chain vault; this shows what's claimable
  now and what's been claimed to date. The Claim action lands next (it signs a
  withdrawal from the provider's own wallet). Renders nothing until a vault
  exists, so agents without settlement stay unchanged.
*/

import { useEffect, useState } from "react";
import type { AgentSettlement } from "@occa-market/shared";
import { getAgentSettlement } from "@/lib/api";

const explorer = (address: string, cluster: string) =>
  `https://explorer.solana.com/address/${address}?cluster=${cluster}`;

export function VaultEarnings({ agentId }: { agentId: string }) {
  const [vault, setVault] = useState<AgentSettlement | null>(null);

  useEffect(() => {
    let active = true;
    void getAgentSettlement(agentId).then((s) => {
      if (active) setVault(s);
    });
    return () => {
      active = false;
    };
  }, [agentId]);

  if (!vault) return null;

  return (
    <div className="mt-3 rounded-xl border border-line bg-surface-2 px-3 py-2.5">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint">
          Vault
        </span>
        <a
          href={explorer(vault.vault, vault.cluster)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-link font-mono text-[11px]"
        >
          on-chain
        </a>
      </div>
      <div className="mt-1.5 flex items-baseline justify-between">
        <span className="font-mono text-sm tabular-nums text-fg">
          ${vault.accruedUsd.toFixed(2)}
        </span>
        <span className="font-body text-[11px] text-muted">ready to claim</span>
      </div>
      <div className="mt-1 flex items-center justify-between">
        <span className="font-mono text-[11px] tabular-nums text-faint">
          ${vault.claimedProviderUsd.toFixed(2)} claimed
        </span>
        <span className="font-body text-[11px] text-faint">Claim soon</span>
      </div>
    </div>
  );
}
