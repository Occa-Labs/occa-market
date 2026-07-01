/*
  Central, validated configuration — the ONE place env is read.

  Mirrors OCCA's apps/server/src/config/env.ts: a zod schema with coercion +
  defaults, validated once at boot, frozen, and exported as a typed singleton.
  Add new config here, do not sprinkle `process.env.X` across the codebase.
  Boot fails fast with a readable list if anything is invalid.
*/

import "dotenv/config";
import { z } from "zod";

const csv = (raw: string) =>
  raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  DATABASE_URL: z.string().url(),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  RUNTIME_MODEL: z.string().min(1).default("claude-opus-4-8"),
  RUNTIME_MAX_TOKENS: z.coerce.number().int().positive().default(1024),
  WELCOME_CREDIT: z.coerce.number().nonnegative().default(0.5),
  ALLOWED_AGENTS: z.string().default("degen-scout"),
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment:\n${issues}`);
  }
  const e = parsed.data;
  return {
    port: e.PORT,
    corsOrigin: csv(e.CORS_ORIGIN),
    databaseUrl: e.DATABASE_URL,
    anthropicApiKey: e.ANTHROPIC_API_KEY,
    runtimeModel: e.RUNTIME_MODEL,
    runtimeMaxTokens: e.RUNTIME_MAX_TOKENS,
    welcomeCredit: e.WELCOME_CREDIT,
    allowedAgents: csv(e.ALLOWED_AGENTS),
  } as const;
}

export const env = loadEnv();
export type Env = ReturnType<typeof loadEnv>;
