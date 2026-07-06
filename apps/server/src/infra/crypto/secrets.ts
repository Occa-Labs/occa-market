/*
  Envelope encryption for the secret-bearing agent columns (tool_configs and
  runtime). A community publisher may embed their own API keys in a tool's MCP
  config, and a BYORT binding carries the gateway bearer — none of that should
  sit in the database as plaintext.

  AES-256-GCM with a single 32-byte master key from SECRETS_MASTER_KEY. The
  value (a JSON document) is encrypted whole and stored back into the SAME jsonb
  column as an envelope object: { __enc: "v1:<iv>:<ct>:<tag>" }, all base64.
  Reads detect the envelope and decrypt; a plaintext (legacy) value passes
  through untouched, so the backfill can run lazily and old rows never break.

  When SECRETS_MASTER_KEY is unset the functions are a no-op (plaintext) with a
  one-time warning — local dev boots without a key; production MUST set one. The
  key never leaves this process, decrypted values live only in memory at the
  point of use, and nothing here logs a plaintext value.

  Rotation path (single key today): add a key-id to the envelope prefix, keep
  the old key available to decrypt, and re-run the backfill to re-seal.
*/

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "../../config/env";

const PREFIX = "v1";
const ENC_KEY = "__enc";

type Envelope = { [ENC_KEY]: string };

let cachedKey: Buffer | null | undefined;
let warned = false;

function masterKey(): Buffer | null {
  if (cachedKey !== undefined) return cachedKey;
  const raw = env.secretsMasterKey;
  if (!raw) {
    cachedKey = null;
    return null;
  }
  const key = /^[0-9a-fA-F]{64}$/.test(raw)
    ? Buffer.from(raw, "hex")
    : Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      "SECRETS_MASTER_KEY must decode to 32 bytes — a base64 or hex 256-bit key",
    );
  }
  cachedKey = key;
  return key;
}

export function isEncrypted(value: unknown): value is Envelope {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Record<string, unknown>)[ENC_KEY] === "string"
  );
}

/** Seal a JSON-serializable value into an envelope. No-op without a key. */
export function encryptSecret<T>(value: T): T | Envelope {
  if (value === null || value === undefined) return value;
  if (isEncrypted(value)) return value; // already sealed — stay idempotent
  const key = masterKey();
  if (!key) {
    if (!warned) {
      console.warn(
        "[crypto] SECRETS_MASTER_KEY not set — agent secrets stored in PLAINTEXT. Set it in production.",
      );
      warned = true;
    }
    return value;
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const pt = Buffer.from(JSON.stringify(value), "utf8");
  const ct = Buffer.concat([cipher.update(pt), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    [ENC_KEY]: `${PREFIX}:${iv.toString("base64")}:${ct.toString("base64")}:${tag.toString("base64")}`,
  };
}

/** Open an envelope back to its value; a non-envelope passes through as-is. */
export function decryptSecret<T>(value: T | Envelope): T {
  if (!isEncrypted(value)) return value as T;
  const key = masterKey();
  if (!key) {
    throw new Error(
      "encountered an encrypted agent secret but SECRETS_MASTER_KEY is not set",
    );
  }
  const [prefix, ivB64, ctB64, tagB64] = value[ENC_KEY].split(":");
  if (prefix !== PREFIX || !ivB64 || !ctB64 || !tagB64) {
    throw new Error("malformed secret envelope");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivB64, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const pt = Buffer.concat([
    decipher.update(Buffer.from(ctB64, "base64")),
    decipher.final(),
  ]);
  return JSON.parse(pt.toString("utf8")) as T;
}

/** Last-4 mask for a secret string, e.g. "…4f2a". For write-only UI previews. */
export function maskSecret(secret: string): string {
  return secret.length <= 4 ? "…" : `…${secret.slice(-4)}`;
}
