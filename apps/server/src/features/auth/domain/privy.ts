/*
  Pure extractors — pull the canonical wallet + email out of a Privy user's
  linked accounts. Prefer a Solana wallet (our payment chain), else any wallet.
  Either may be absent depending on how the user signed in.
*/

import type { User } from "@privy-io/server-auth";

export function pickWallet(user: User): string | null {
  const wallets = user.linkedAccounts.filter((a) => a.type === "wallet");
  const solana = wallets.find(
    (a) => (a as { chainType?: string }).chainType === "solana",
  );
  const chosen = solana ?? wallets[0];
  return chosen ? ((chosen as { address?: string }).address ?? null) : null;
}

export function pickEmail(user: User): string | null {
  const account = user.linkedAccounts.find((a) => a.type === "email");
  return account ? ((account as { address?: string }).address ?? null) : null;
}
