/*
  Throwaway x402 devnet client — drives one paid turn end-to-end against the
  local server so we can watch a real settled x402 charge land in history.
  Not shipped; delete after the smoke test.
*/
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import * as anchor from "@coral-xyz/anchor";
import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";

const SERVER = process.env.SERVER ?? "http://localhost:4999";
const AGENT = process.env.AGENT ?? "degen-scout";
const RPC = "https://solana-devnet.g.alchemy.com/v2/7w5xbSbZVLzcf4Q2hjLBV";
const PAYER_PATH = process.env.PAYER_PATH!;
const TOKEN_PROGRAM = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const MEMO_PROGRAM = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

const payer = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(readFileSync(PAYER_PATH, "utf8"))),
);
const url = `${SERVER}/api/x402/agents/${AGENT}/messages`;
const body = JSON.stringify({ message: "Devnet x402 smoke test — what's a degen play right now?" });

// 1) First call with no payment → 402 carrying the requirements.
const first = await fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body,
});
console.log("step 1 status:", first.status);
const challenge = (await first.json()) as any;
if (first.status !== 402) {
  console.log("expected 402, got:", challenge);
  process.exit(1);
}
const req = challenge.accepts[0];
console.log("requirements:", {
  network: req.network,
  amount: req.amount,
  asset: req.asset,
  payTo: req.payTo,
  feePayer: req.extra.feePayer,
});

// 2) Build the payment transaction (ComputeBudget ×2, TransferChecked, Memo).
const connection = new Connection(RPC, "confirmed");
const mint = new PublicKey(req.asset);
const feePayer = new PublicKey(req.extra.feePayer);
const payTo = new PublicKey(req.payTo);
const decimals = (await connection.getTokenSupply(mint)).value.decimals;
const sourceAta = anchor.utils.token.associatedAddress({ mint, owner: payer.publicKey });
// payTo is the vault PDA (off-curve owner) — its ATA is where funds land.
const destAta = anchor.utils.token.associatedAddress({ mint, owner: payTo });
const amount = BigInt(req.amount);

const transferData = Buffer.alloc(10);
transferData.writeUInt8(12, 0); // TransferChecked
transferData.writeBigUInt64LE(amount, 1);
transferData.writeUInt8(decimals, 9);
const transferChecked = new TransactionInstruction({
  programId: TOKEN_PROGRAM,
  keys: [
    { pubkey: sourceAta, isSigner: false, isWritable: true },
    { pubkey: mint, isSigner: false, isWritable: false },
    { pubkey: destAta, isSigner: false, isWritable: true },
    { pubkey: payer.publicKey, isSigner: true, isWritable: false },
  ],
  data: transferData,
});
const memo = new TransactionInstruction({
  programId: MEMO_PROGRAM,
  keys: [],
  data: Buffer.from(randomBytes(16).toString("hex"), "utf8"),
});

const { blockhash } = await connection.getLatestBlockhash("finalized");
const message = new TransactionMessage({
  payerKey: feePayer, // facilitator sponsors fees; it signs later
  recentBlockhash: blockhash,
  instructions: [
    ComputeBudgetProgram.setComputeUnitLimit({ units: 20_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
    transferChecked,
    memo,
  ],
}).compileToV0Message();
const tx = new VersionedTransaction(message);
tx.sign([payer]); // partial: payer only, feePayer slot stays empty
const b64tx = Buffer.from(tx.serialize()).toString("base64");

const paymentPayload = {
  x402Version: 2,
  accepted: req,
  payload: { transaction: b64tx },
};
const header = Buffer.from(JSON.stringify(paymentPayload), "utf8").toString("base64");

// 3) Retry with the PAYMENT-SIGNATURE header.
const second = await fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json", "PAYMENT-SIGNATURE": header },
  body,
});
console.log("step 3 status:", second.status);
const result = (await second.json()) as any;
if (result.payment) console.log("settled tx:", result.payment.transaction);
if (result.blocks) console.log("agent reply blocks:", result.blocks.length);
if (!second.ok) console.log("body:", JSON.stringify(result, null, 2));
