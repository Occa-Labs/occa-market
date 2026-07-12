"use client";

/*
  Settlement earnings for one agent on its dashboard card. x402 payments accrue
  in the agent's on-chain vault; the provider claims to split their take from
  the fee, on-chain. Claiming is server-cranked (the destinations are fixed by
  the program, so the crank can't redirect a cent) and owner-only. Renders
  nothing until a vault exists, so agents without settlement stay unchanged.
*/

import { useCallback, useEffect, useState } from "react";
import type { AgentSettlement } from "@occa-market/shared";
import { Button } from "@/components/ui/button";
import { claimVault, getAgentSettlement } from "@/lib/api";

const MIN_CLAIM_USD = 1;

const explorer = (id: string, cluster: string, kind: "address" | "tx" = "address") =>
  `https://explorer.solana.com/${kind}/${id}?cluster=${cluster}`;

export function VaultEarnings({ agentId }: { agentId: string }) {
  const [vault, setVault] = useState<AgentSettlement | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(() => {
    void getAgentSettlement(agentId).then(setVault);
  }, [agentId]);

  useEffect(() => {
    let active = true;
    void getAgentSettlement(agentId).then((s) => {
      if (active) setVault(s);
    });
    return () => {
      active = false;
    };
  }, [agentId]);

  async function claim() {
    if (claiming) return;
    setClaiming(true);
    setNote(null);
    try {
      const res = await claimVault(agentId);
      if (res.ok) {
        setNote({ ok: true, text: `Claimed $${res.claimedUsd.toFixed(2)}.` });
        load(); // accrued → 0, claimed → +take
      } else {
        setNote({ ok: false, text: humanize(res.error) });
      }
    } finally {
      setClaiming(false);
    }
  }

  if (!vault) return null;

  const claimable = vault.accruedUsd >= MIN_CLAIM_USD;

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

      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] tabular-nums text-faint">
          ${vault.claimedProviderUsd.toFixed(2)} claimed
        </span>
        <Button size="sm" onClick={claim} disabled={!claimable || claiming}>
          {claiming ? "Claiming…" : "Claim"}
        </Button>
      </div>

      {!claimable && !note && (
        <p className="mt-1.5 font-body text-[11px] text-faint">
          Min ${MIN_CLAIM_USD.toFixed(2)} to claim.
        </p>
      )}
      {note && (
        <p
          className={`mt-1.5 font-body text-[11px] ${note.ok ? "text-muted" : "text-bad"}`}
        >
          {note.text}
        </p>
      )}
    </div>
  );
}

function humanize(code: string): string {
  switch (code) {
    case "below_minimum":
      return `Vault is below the $${MIN_CLAIM_USD.toFixed(2)} minimum.`;
    case "no_vault":
      return "No vault for this agent yet.";
    case "settlement_disabled":
      return "Settlement isn't enabled.";
    default:
      return code;
  }
}
