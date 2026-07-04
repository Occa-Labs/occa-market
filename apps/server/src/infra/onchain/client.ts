/*
  On-chain provenance client — the ONE place the server talks to Solana.

  The market runs as a single company ("OCCA Market") on the OCCA registry
  program (devnet). Each catalog agent gets an AgentIdentity + Deployment PDA
  under that company; the daily anchor job commits one Merkle root per agent
  per UTC day over its replies + ratings. Reputation stays a derived view —
  the chain holds the tamper-evident inputs, never a score.

  Everything is lazy and optional: if the onchain env block is incomplete the
  server runs fully off-chain and every entry point here is a no-op guard.
*/

import { readFileSync } from "node:fs";
import * as anchor from "@coral-xyz/anchor";
import BN from "bn.js";
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { env } from "../../config/env";
import registryIdl from "./idl/registry.json";

const OPERATIONS_KIND_ANCHOR = 1;

/** Sentinel adapter id — market agents bring their own runtime (BYORT). */
const ADAPTER_NONE = PublicKey.default;

const ZERO_HASH: number[] = Array(32).fill(0);

export type OnchainRegistration = {
  agentPubkey: string;
  identityPda: string;
  deploymentPda: string;
  deploymentIndex: number;
};

type Ctx = {
  connection: Connection;
  registry: anchor.Program;
  owner: Keypair;
  anchorSigner: Keypair;
  companyPda: PublicKey;
};

let cached: Ctx | null = null;

export function onchainEnabled(): boolean {
  return env.onchain.enabled;
}

/** Cluster name for explorer links, derived from the configured RPC. */
export function onchainCluster(): string {
  return env.onchain.rpcUrl.includes("devnet") ? "devnet" : "mainnet-beta";
}

function loadKeypair(path: string): Keypair {
  return Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(readFileSync(path, "utf-8"))),
  );
}

function ctx(): Ctx {
  if (cached) return cached;
  if (!env.onchain.enabled) {
    throw new Error("onchain is not configured (see ONCHAIN_* env)");
  }
  const owner = loadKeypair(env.onchain.ownerKeypairPath!);
  const anchorSigner = loadKeypair(env.onchain.anchorKeypairPath!);
  const connection = new Connection(env.onchain.rpcUrl, "confirmed");
  const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(owner), {
    commitment: "confirmed",
  });
  const registry = new anchor.Program(registryIdl as anchor.Idl, provider);
  cached = {
    connection,
    registry,
    owner,
    anchorSigner,
    companyPda: new PublicKey(env.onchain.companyPda!),
  };
  return cached;
}

function u32Le(value: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(value, 0);
  return b;
}

function i64Le(value: bigint): Buffer {
  const b = Buffer.alloc(8);
  b.writeBigInt64LE(value, 0);
  return b;
}

function registryId(): PublicKey {
  return new PublicKey(env.onchain.registryProgramId);
}

function treasuryId(): PublicKey {
  return new PublicKey(env.onchain.treasuryProgramId);
}

export function deriveAgentIdentityPda(agentPubkey: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("agent_identity"), agentPubkey.toBuffer()],
    registryId(),
  )[0];
}

export function deriveDeploymentPda(company: PublicKey, index: number): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("deployment"), company.toBuffer(), u32Le(index)],
    registryId(),
  )[0];
}

export function deriveOperationsPda(company: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("operations"), company.toBuffer(), Buffer.from([OPERATIONS_KIND_ANCHOR])],
    treasuryId(),
  )[0];
}

export function deriveDailyAnchorPda(deployment: PublicKey, dayUnix: number): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("daily_anchor"), deployment.toBuffer(), i64Le(BigInt(dayUnix))],
    registryId(),
  )[0];
}

/**
 * Mint an AgentIdentity + Deployment for a market agent under the OCCA Market
 * company. The identity seed is a fresh pubkey — no secret is kept, the PDA
 * is the durable handle. Two txs, owner signs and pays.
 *
 * `deploymentIndexHint` is where the on-chain probe starts: the chain may
 * hold indices the DB no longer knows (deleted rows keep their PDA forever),
 * so the first actually-free index wins.
 */
export async function registerAgentOnchain(
  agentId: string,
  name: string,
  deploymentIndexHint: number,
): Promise<OnchainRegistration> {
  const { connection, registry, owner, companyPda } = ctx();
  const agentPubkey = Keypair.generate().publicKey;
  const identityPda = deriveAgentIdentityPda(agentPubkey);

  let deploymentIndex = deploymentIndexHint;
  let deploymentPda = deriveDeploymentPda(companyPda, deploymentIndex);
  while (await connection.getAccountInfo(deploymentPda)) {
    deploymentIndex++;
    deploymentPda = deriveDeploymentPda(companyPda, deploymentIndex);
  }
  const metadataUri = `occa://market/agents/${agentId}`;

  await registry.methods
    .registerAgentIdentity(agentPubkey, name, metadataUri, ZERO_HASH)
    .accounts({
      identity: identityPda,
      owner: owner.publicKey,
      payer: owner.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  await registry.methods
    .createDeployment(deploymentIndex, "market_agent", null, ADAPTER_NONE, metadataUri, ZERO_HASH)
    .accounts({
      company: companyPda,
      identity: identityPda,
      owner: owner.publicKey,
      deployment: deploymentPda,
      payer: owner.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return {
    agentPubkey: agentPubkey.toBase58(),
    identityPda: identityPda.toBase58(),
    deploymentPda: deploymentPda.toBase58(),
    deploymentIndex,
  };
}

/**
 * Commit one day's Merkle root for a deployment. `dayUnix` must be a UTC
 * midnight; the program enforces one anchor per (deployment, day) via the
 * PDA seed. Returns the tx signature.
 */
export async function commitDailyAnchorOnchain(
  deploymentPda: string,
  dayUnix: number,
  merkleRoot: Buffer,
  taskCount: number,
): Promise<string> {
  const { registry, owner, anchorSigner, companyPda } = ctx();
  const deployment = new PublicKey(deploymentPda);

  return registry.methods
    .commitDailyAnchor(new BN(dayUnix), Array.from(merkleRoot), taskCount)
    .accounts({
      deployment,
      company: companyPda,
      anchorSigner: anchorSigner.publicKey,
      operations: deriveOperationsPda(companyPda),
      dailyAnchor: deriveDailyAnchorPda(deployment, dayUnix),
      payer: owner.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .signers([anchorSigner])
    .rpc();
}
