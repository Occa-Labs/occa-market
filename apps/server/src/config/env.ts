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

// A present-but-empty env var ("PRIVY_APP_ID=") should behave like unset, so
// optionals stay optional and defaults still apply. dotenv gives "", not undefined.
const opt = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (v === "" ? undefined : v), schema);

const envSchema = z.object({
  PORT: opt(z.coerce.number().int().positive().default(4000)),
  CORS_ORIGIN: opt(z.string().default("http://localhost:3000")),
  DATABASE_URL: z.string().url(),
  ANTHROPIC_API_KEY: opt(z.string().min(1).optional()),
  RUNTIME_MODEL: opt(z.string().min(1).default("claude-opus-4-8")),
  RUNTIME_MAX_TOKENS: opt(z.coerce.number().int().positive().default(1024)),
  WELCOME_CREDIT: opt(z.coerce.number().nonnegative().default(0.5)),
  ALLOWED_AGENTS: opt(z.string().default("degen-scout")),
  // Auth. JWT_SECRET signs our own session token (required, fail-fast).
  // Privy creds are optional so the app boots without them; the Privy login
  // route errors only when actually hit unconfigured.
  JWT_SECRET: z.string().min(1, "JWT_SECRET is required"),
  PRIVY_APP_ID: opt(z.string().min(1).optional()),
  PRIVY_APP_SECRET: opt(z.string().min(1).optional()),
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
    jwtSecret: e.JWT_SECRET,
    privyAppId: e.PRIVY_APP_ID,
    privyAppSecret: e.PRIVY_APP_SECRET,
  } as const;
}

export const env = loadEnv();
export type Env = ReturnType<typeof loadEnv>;
