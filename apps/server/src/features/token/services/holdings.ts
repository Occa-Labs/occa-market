/*
  $OCCA holdings reader — the one place the server reads a wallet's token
  balance. Mainnet RPC (the mint lives on pump.fun), separate from the devnet
  provenance connection.

  Snapshot semantics: the users row caches the last good read with a TTL.
  Within TTL we serve the cache (no RPC on the chat hot path); past TTL we
  re-read; if the RPC is down we serve the stale snapshot rather than failing
  the request — a flaky RPC must never lock a holder out.
*/

import { Connection, PublicKey } from "@solana/web3.js";
import { eq } from "drizzle-orm";
import { env } from "../../../config/env";
import { db } from "../../../infra/database/client";
import { users, type UserRow } from "../../../infra/database/schema";

let connection: Connection | null = null;

function rpc(): Connection {
  connection ??= new Connection(env.token.rpcUrl, "confirmed");
  return connection;
}

/** Sum a wallet's $OCCA across its token accounts, as a UI amount. */
export async function readWalletBalance(walletAddress: string): Promise<number> {
  const { value } = await rpc().getParsedTokenAccountsByOwner(
    new PublicKey(walletAddress),
    { mint: new PublicKey(env.token.mint) },
  );
  return value.reduce(
    (sum, { account }) =>
      sum + (account.data.parsed?.info?.tokenAmount?.uiAmount ?? 0),
    0,
  );
}

export type HoldingsSnapshot = {
  balance: number;
  checkedAt: Date | null;
};

/**
 * The user's holdings, from cache when fresh. `force` skips the TTL (the
 * "I just bought" refresh button). No linked wallet reads as zero.
 */
export async function getHoldings(
  user: UserRow,
  opts: { force?: boolean } = {},
): Promise<HoldingsSnapshot> {
  if (!user.walletAddress) return { balance: 0, checkedAt: null };

  const age = user.tokenCheckedAt
    ? Date.now() - user.tokenCheckedAt.getTime()
    : Infinity;
  if (!opts.force && age < env.token.cacheTtlMs) {
    return { balance: user.tokenBalance, checkedAt: user.tokenCheckedAt };
  }

  try {
    const balance = await readWalletBalance(user.walletAddress);
    const checkedAt = new Date();
    await db
      .update(users)
      .set({ tokenBalance: balance, tokenCheckedAt: checkedAt })
      .where(eq(users.id, user.id));
    return { balance, checkedAt };
  } catch (err) {
    console.warn(
      `[token] balance read failed for ${user.walletAddress}, serving snapshot:`,
      err instanceof Error ? err.message : err,
    );
    return { balance: user.tokenBalance, checkedAt: user.tokenCheckedAt };
  }
}
