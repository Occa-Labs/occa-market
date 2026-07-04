/*
  One-time devnet bootstrap for the market's on-chain footprint.

  Creates the single "OCCA Market" company on the OCCA registry program
  (atomically with its treasury + policy via CPI), then registers the
  Anchor-kind OperationsAccount whitelisted for commit_daily_anchor +
  commit_trace, signed by the market's anchor wallet.

  Idempotent: both PDAs are checked before creation, so re-running is a
  no-op that just prints the addresses. Prints the ONCHAIN_* env lines to
  paste into apps/server/.env when done.

  Run from apps/server: pnpm onchain:bootstrap
*/

import { readFileSync } from "node:fs";
import * as anchor from "@coral-xyz/anchor";
import BN from "bn.js";
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { env } from "../config/env";
import registryIdl from "../infra/onchain/idl/registry.json";
import treasuryIdl from "../infra/onchain/idl/treasury.json";

const COMPANY_NONCE = 1;
const OPERATIONS_KIND_ANCHOR = 1;

const OWNER_PATH = env.onchain.ownerKeypairPath ?? ".keys/market-owner.json";
const ANCHOR_PATH = env.onchain.anchorKeypairPath ?? ".keys/market-anchor.json";

function loadKeypair(path: string): Keypair {
  return Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(readFileSync(path, "utf-8"))),
  );
}

function u32Le(value: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(value, 0);
  return b;
}

function ixDiscriminator(idl: anchor.Idl, name: string): number[] {
  const ix = idl.instructions.find((i) => i.name === name);
  if (!ix?.discriminator) throw new Error(`instruction ${name} not in IDL`);
  return ix.discriminator as number[];
}

async function main() {
  const registryProgramId = new PublicKey(env.onchain.registryProgramId);
  const treasuryProgramId = new PublicKey(env.onchain.treasuryProgramId);

  const owner = loadKeypair(OWNER_PATH);
  const anchorSigner = loadKeypair(ANCHOR_PATH);
  const connection = new Connection(env.onchain.rpcUrl, "confirmed");
  const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(owner), {
    commitment: "confirmed",
  });
  const registry = new anchor.Program(registryIdl as anchor.Idl, provider);
  const treasury = new anchor.Program(treasuryIdl as anchor.Idl, provider);

  const balance = await connection.getBalance(owner.publicKey);
  console.log(`Owner:         ${owner.publicKey.toBase58()} (${balance / 1e9} SOL)`);
  console.log(`Anchor wallet: ${anchorSigner.publicKey.toBase58()}`);
  if (balance < 0.05 * 1e9) throw new Error("fund the owner wallet ≥ 0.05 SOL first");

  const [companyPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("company"), owner.publicKey.toBuffer(), u32Le(COMPANY_NONCE)],
    registryProgramId,
  );
  const [treasuryPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("treasury"), companyPda.toBuffer()],
    treasuryProgramId,
  );
  const [policyPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("policy"), companyPda.toBuffer()],
    treasuryProgramId,
  );
  const [operationsPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("operations"), companyPda.toBuffer(), Buffer.from([OPERATIONS_KIND_ANCHOR])],
    treasuryProgramId,
  );

  console.log(`\nCompany PDA:    ${companyPda.toBase58()}`);
  console.log(`Treasury PDA:   ${treasuryPda.toBase58()}`);
  console.log(`Operations PDA: ${operationsPda.toBase58()}`);

  if (await connection.getAccountInfo(companyPda)) {
    console.log("\ncompany already exists — skipping create_company");
  } else {
    console.log("\ncreate_company('OCCA Market')…");
    const sig = await registry.methods
      .createCompany(
        COMPANY_NONCE,
        "OCCA Market",
        "en",
        "https://github.com/Occa-Labs/occa-market",
        Array(32).fill(0),
      )
      .accounts({
        company: companyPda,
        owner: owner.publicKey,
        payer: owner.publicKey,
        treasury: treasuryPda,
        policy: policyPda,
        treasuryProgram: treasuryProgramId,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    console.log(`  tx: https://explorer.solana.com/tx/${sig}?cluster=devnet`);
  }

  if (await connection.getAccountInfo(operationsPda)) {
    console.log("anchor operations already registered — skipping");
  } else {
    console.log("register_company_operations(Anchor, whitelist daily+trace)…");
    const sig = await treasury.methods
      .registerCompanyOperations(
        { anchor: {} },
        anchorSigner.publicKey,
        [
          ixDiscriminator(registryIdl as anchor.Idl, "commit_daily_anchor"),
          ixDiscriminator(registryIdl as anchor.Idl, "commit_trace"),
        ],
        10_000, // rate_limit_per_period (not enforced in phase 1)
        new BN(0), // no expiry
      )
      .accounts({
        company: companyPda,
        controllingAuthority: owner.publicKey,
        operations: operationsPda,
        payer: owner.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    console.log(`  tx: https://explorer.solana.com/tx/${sig}?cluster=devnet`);
  }

  console.log(`\nDone. Ensure apps/server/.env carries:`);
  console.log(`ONCHAIN_COMPANY_PDA=${companyPda.toBase58()}`);
  console.log(`ONCHAIN_OWNER_KEYPAIR=${OWNER_PATH}`);
  console.log(`ONCHAIN_ANCHOR_KEYPAIR=${ANCHOR_PATH}`);
}

main().catch((err) => {
  console.error("bootstrap failed:", err);
  process.exit(1);
});
