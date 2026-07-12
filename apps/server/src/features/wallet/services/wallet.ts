/*
  Wallet summary — a provider's money in one read: spendable USDC in their
  linked wallet plus settlement earnings summed across every agent they own.
  Read-only; the chain is the source of truth, this just aggregates it.
*/

import { Connection, PublicKey } from "@solana/web3.js";
import { microsToUsd, type WalletSummary } from "@occa-market/shared";
import { env } from "../../../config/env";
import { findUserById } from "../../auth/repositories/users";
import { listOwnerOnchainAgents } from "../../agents/repositories/agents";
import { readVault } from "../../../infra/onchain/settlement";

let usdcRpc: Connection | null = null;

// USDC lives on the token cluster (mainnet in prod), the same RPC the $OCCA
// reader uses — a separate connection from the devnet settlement/provenance one.
function rpc(): Connection {
  usdcRpc ??= new Connection(env.token.rpcUrl, "confirmed");
  return usdcRpc;
}

/** Sum a wallet's USDC across its token accounts, in micro-USD. 0 on any error
 *  (an unread balance must never fail the whole summary). */
async function readWalletUsdcMicros(walletAddress: string): Promise<number> {
  try {
    const { value } = await rpc().getParsedTokenAccountsByOwner(
      new PublicKey(walletAddress),
      { mint: new PublicKey(env.credits.usdcMint) },
    );
    const ui = value.reduce(
      (sum, { account }) =>
        sum + (account.data.parsed?.info?.tokenAmount?.uiAmount ?? 0),
      0,
    );
    return Math.round(ui * 1_000_000);
  } catch {
    return 0;
  }
}

export async function walletSummary(userId: string): Promise<WalletSummary> {
  const user = await findUserById(userId);
  const walletAddress = user?.walletAddress ?? null;

  const spendableMicros = walletAddress
    ? await readWalletUsdcMicros(walletAddress)
    : 0;

  // Earnings across every owned agent that has a vault.
  let claimableMicros = 0;
  let claimedMicros = 0;
  let agents = 0;
  for (const agent of await listOwnerOnchainAgents(userId)) {
    const vault = await readVault(agent.agentPubkey);
    if (!vault) continue;
    agents++;
    claimableMicros += vault.accruedMicros;
    claimedMicros += vault.claimedProviderMicros;
  }

  return {
    walletAddress,
    spendableUsdcUsd: microsToUsd(spendableMicros),
    earnings: {
      claimableUsd: microsToUsd(claimableMicros),
      claimedUsd: microsToUsd(claimedMicros),
      agents,
    },
  };
}
