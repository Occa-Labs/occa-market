/*
  Settlement client — the server's link to the occa-market settlement program
  (per-agent non-custodial USDC vaults). Separate program, separate repo
  (occa-market-programs), so this is its own module rather than folded into the
  registry/treasury client.

  Role here is narrow: derive an agent's vault address (the x402 `payTo`) and
  create the vault when an agent publishes. The split + claim live on-chain;
  the server never moves vault funds. Everything is lazy and optional — with
  the settlement env block unset, every entry point is a no-op guard and the
  x402 rail keeps paying the treasury wallet (phase 1).
*/

import { readFileSync } from "node:fs";
import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { env } from "../../config/env";
import settlementIdl from "./idl/settlement.json";

type Ctx = {
  connection: Connection;
  program: anchor.Program;
  authority: Keypair;
  programId: PublicKey;
};

let cached: Ctx | null = null;

export function settlementEnabled(): boolean {
  return env.settlement.enabled;
}

function loadKeypair(path: string): Keypair {
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(path, "utf-8"))));
}

function ctx(): Ctx {
  if (cached) return cached;
  if (!env.settlement.enabled) {
    throw new Error("settlement is not configured (see SETTLEMENT_* env)");
  }
  const authority = loadKeypair(env.settlement.authorityKeypairPath!);
  // The vault lives on the cluster where x402 payments settle; reuse the
  // provenance RPC (both devnet today).
  const connection = new Connection(env.onchain.rpcUrl, "confirmed");
  const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(authority), {
    commitment: "confirmed",
  });
  const program = new anchor.Program(settlementIdl as anchor.Idl, provider);
  cached = { connection, program, authority, programId: new PublicKey(env.settlement.programId!) };
  return cached;
}

export function deriveConfigPda(programId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from("config")], programId)[0];
}

export function deriveVaultPda(agentPubkey: PublicKey, programId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), agentPubkey.toBuffer()],
    programId,
  )[0];
}

/** The vault PDA's USDC associated token account — where x402 payments land. */
export function deriveVaultAta(agentPubkey: PublicKey, programId: PublicKey): PublicKey {
  const vault = deriveVaultPda(agentPubkey, programId);
  return anchor.utils.token.associatedAddress({
    mint: new PublicKey(env.credits.usdcMint),
    owner: vault,
  });
}

/**
 * The x402 `payTo` for an agent: its vault PDA (owner). The exact-scheme client
 * derives the destination ATA from (payTo, asset), which resolves to the vault
 * ATA. Pure derivation — no RPC, no keypair — so it's safe in the 402 hot path.
 * Returns null when settlement is off or the agent has no on-chain pubkey.
 */
export function vaultPayTo(agentPubkey: string | null | undefined): string | null {
  if (!env.settlement.enabled || !agentPubkey) return null;
  const programId = new PublicKey(env.settlement.programId!);
  return deriveVaultPda(new PublicKey(agentPubkey), programId).toBase58();
}

/**
 * Create an agent's vault + its USDC ATA if it doesn't exist yet. Authority
 * signs and pays rent (~0.002 SOL). Best-effort and idempotent: a live vault
 * short-circuits, and any chain hiccup logs and returns false so a publish is
 * never blocked. `providerWallet` is where this agent's claims will pay out.
 */
export async function ensureAgentVault(
  agentPubkey: string,
  agentId: string,
  providerWallet: string,
): Promise<boolean> {
  if (!settlementEnabled()) return false;
  const { program, authority, programId } = ctx();
  const agent = new PublicKey(agentPubkey);
  const vault = deriveVaultPda(agent, programId);
  if (await program.provider.connection.getAccountInfo(vault)) return false;

  await program.methods
    .initVault(agent, agentId, new PublicKey(providerWallet), PublicKey.default)
    .accountsPartial({ authority: authority.publicKey, usdcMint: new PublicKey(env.credits.usdcMint) })
    .rpc();
  console.log(`[settlement] vault created for ${agentId}: ${vault.toBase58()}`);
  return true;
}

export type VaultState = {
  vault: string;
  providerWallet: string;
  feeBps: number;
  /** USDC currently in the vault ATA (micro-USD), claimable now. */
  accruedMicros: number;
  claimedProviderMicros: number;
  claimedFeeMicros: number;
};

/** Devnet vs mainnet, derived from the RPC — for explorer links. */
export function settlementCluster(): string {
  return env.onchain.rpcUrl.includes("devnet") ? "devnet" : "mainnet-beta";
}

/** Read a vault's on-chain state, or null if it doesn't exist / settlement off. */
export async function readVault(agentPubkey: string): Promise<VaultState | null> {
  if (!settlementEnabled()) return null;
  const { program, programId, connection } = ctx();
  const vault = deriveVaultPda(new PublicKey(agentPubkey), programId);
  // The IDL is loaded untyped, so reach the account namespace dynamically.
  const acc = await (program.account as Record<string, any>).agentVault.fetchNullable(vault);
  if (!acc) return null;

  // Current claimable balance = the vault ATA's USDC amount (0 if never funded).
  let accruedMicros = 0;
  try {
    const ata = deriveVaultAta(new PublicKey(agentPubkey), programId);
    const bal = await connection.getTokenAccountBalance(ata);
    accruedMicros = Number(bal.value.amount);
  } catch {
    accruedMicros = 0;
  }

  return {
    vault: vault.toBase58(),
    providerWallet: acc.providerWallet.toBase58(),
    feeBps: acc.feeBps,
    accruedMicros,
    claimedProviderMicros: acc.claimedProvider.toNumber(),
    claimedFeeMicros: acc.claimedFee.toNumber(),
  };
}

/** Minimum claimable balance the program enforces (micro-USD). Mirrored here
 *  so the UI can disable the button with a reason instead of failing on-chain. */
export const MIN_CLAIM_MICROS = 1_000_000;

export type ClaimResult =
  | { ok: true; txSig: string; providerMicros: number; feeMicros: number }
  | { ok: false; error: string };

/**
 * Crank an agent's vault claim: split the balance to the provider wallet + fee
 * treasury on-chain, in one transaction. The claim is permissionless (the
 * destinations are fixed by the program), so the server signing as the fee
 * payer cannot redirect a cent — it only triggers and pays the tx. Returns the
 * split that landed, or a reason it couldn't.
 */
export async function claimVault(agentPubkey: string): Promise<ClaimResult> {
  if (!settlementEnabled()) return { ok: false, error: "settlement_disabled" };
  const { program, authority, programId, connection } = ctx();
  const agent = new PublicKey(agentPubkey);
  const vault = deriveVaultPda(agent, programId);

  const acc = await (program.account as Record<string, any>).agentVault.fetchNullable(vault);
  if (!acc) return { ok: false, error: "no_vault" };
  const config = await (program.account as Record<string, any>).marketConfig.fetch(
    deriveConfigPda(programId),
  );

  // Balance + split preview (the program recomputes and enforces the same).
  const ata = deriveVaultAta(agent, programId);
  let balance = 0;
  try {
    balance = Number((await connection.getTokenAccountBalance(ata)).value.amount);
  } catch {
    balance = 0;
  }
  if (balance < MIN_CLAIM_MICROS) return { ok: false, error: "below_minimum" };
  const providerMicros = Math.floor((balance * 10_000) / (10_000 + acc.feeBps));
  const feeMicros = balance - providerMicros;

  const txSig = await (program.methods as Record<string, any>)
    .claim(agent)
    .accountsPartial({
      vault,
      usdcMint: config.usdcMint,
      providerWallet: acc.providerWallet,
      feeTreasury: config.feeTreasury,
      cranker: authority.publicKey,
    })
    .rpc();

  return { ok: true, txSig, providerMicros, feeMicros };
}
