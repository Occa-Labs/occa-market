/*
  Unit tests for the envelope encryption on the secret-bearing agent columns.
  Guards the seal against a refactor that silently bypasses it: roundtrip,
  tamper detection, legacy-plaintext passthrough, idempotence, null-safety.

  The crypto module reads SECRETS_MASTER_KEY through config/env, which validates
  the whole environment at import time. Set a known, valid env FIRST, then
  dynamically import the module so its evaluation sees these values — a static
  import would hoist above the assignments and boot the config against the
  ambient env. dotenv won't override an already-set var, so this stays hermetic.
*/

import { test } from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL = "postgres://localhost:5432/test";
process.env.JWT_SECRET = "x".repeat(32);
process.env.SECRETS_MASTER_KEY = Buffer.alloc(32, 7).toString("base64");

const { encryptSecret, decryptSecret, isEncrypted } = await import("./secrets");

test("roundtrip: encrypt then decrypt returns the original", () => {
  const value = { apiKey: "sk-live-abcd1234", env: { X: "y" } };
  const sealed = encryptSecret(value);
  assert.ok(isEncrypted(sealed), "sealed value should be an envelope");
  assert.notDeepEqual(sealed, value);
  assert.deepEqual(decryptSecret(sealed), value);
});

test("idempotence: encrypting an existing envelope is a no-op", () => {
  const sealed = encryptSecret({ a: 1 });
  assert.deepEqual(encryptSecret(sealed), sealed);
});

test("passthrough: decrypting a non-envelope returns it unchanged (legacy plaintext)", () => {
  const plain = [{ name: "tool", config: {} }];
  assert.deepEqual(decryptSecret(plain), plain);
});

test("null-safety: null/undefined pass through both ways", () => {
  assert.equal(encryptSecret(null), null);
  assert.equal(encryptSecret(undefined), undefined);
  assert.equal(decryptSecret(null), null);
});

test("tamper: a flipped ciphertext byte fails the GCM auth tag", () => {
  const sealed = encryptSecret({ secret: "top" }) as { __enc: string };
  const [prefix, iv, ct, tag] = sealed.__enc.split(":");
  const bytes = Buffer.from(ct, "base64");
  bytes[0] ^= 0x01;
  const tampered = { __enc: `${prefix}:${iv}:${bytes.toString("base64")}:${tag}` };
  assert.throws(() => decryptSecret(tampered));
});
