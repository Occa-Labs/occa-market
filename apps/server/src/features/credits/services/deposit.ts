/*
  Deposit verification — the trust boundary of the custodial ledger. The user
  sends USDC to the market's deposit wallet from their linked wallet, then
  submits the tx signature; we read the transaction off mainnet and credit
  exactly what the deposit wallet's USDC balance gained, only if the linked
  wallet was the sender. Token-balance deltas (pre/post) are used instead of
  instruction parsing so transfers via any wallet UI verify the same way.
*/

import { Connection } from "@solana/web3.js";
import { env } from "../../../config/env";
import type { UserRow } from "../../../infra/database/schema";
import { hasDeposit, insertDeposit } from "../repositories/ledger";

let connection: Connection | null = null;

function rpc(): Connection {
  connection ??= new Connection(env.token.rpcUrl, "confirmed");
  return connection;
}

export type DepositResult =
  | { ok: true; creditedMicros: number }
  | { ok: false; error: string };

export async function verifyAndCredit(
  user: UserRow,
  txSignature: string,
): Promise<DepositResult> {
  if (!env.credits.enabled || !env.credits.depositWallet) {
    return { ok: false, error: "deposits are not enabled on this server" };
  }
  if (!user.walletAddress) {
    return { ok: false, error: "link a wallet before depositing" };
  }
  if (await hasDeposit(txSignature)) {
    return { ok: false, error: "this transaction was already credited" };
  }

  let tx;
  try {
    tx = await rpc().getParsedTransaction(txSignature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });
  } catch {
    return { ok: false, error: "couldn't read the transaction from the chain" };
  }
  if (!tx) return { ok: false, error: "transaction not found — wait for confirmation and retry" };
  const meta = tx.meta;
  if (!meta) return { ok: false, error: "transaction has no metadata to verify" };
  if (meta.err) return { ok: false, error: "that transaction failed on-chain" };

  // What did the deposit wallet gain, and did the linked wallet pay?
  const byOwner = (owner: string, balances: typeof meta.preTokenBalances) =>
    (balances ?? [])
      .filter((b) => b.mint === env.credits.usdcMint && b.owner === owner)
      .reduce((s, b) => s + Number(b.uiTokenAmount.amount), 0);

  const gained =
    byOwner(env.credits.depositWallet, meta.postTokenBalances) -
    byOwner(env.credits.depositWallet, meta.preTokenBalances);
  const senderPaid =
    byOwner(user.walletAddress, meta.preTokenBalances) -
    byOwner(user.walletAddress, meta.postTokenBalances);

  if (gained <= 0) {
    return { ok: false, error: "no USDC arrived at the deposit wallet in that transaction" };
  }
  if (senderPaid <= 0) {
    return { ok: false, error: "that transfer didn't come from your linked wallet" };
  }

  // USDC has 6 decimals, so raw token units ARE micro-USD.
  const creditedMicros = Math.min(gained, senderPaid);
  try {
    await insertDeposit({ userId: user.id, amountMicros: creditedMicros, txSignature });
  } catch {
    // Unique tx_signature lost a race with a concurrent submit of the same tx.
    return { ok: false, error: "this transaction was already credited" };
  }
  return { ok: true, creditedMicros };
}
