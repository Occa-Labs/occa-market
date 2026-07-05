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
  ALLOWED_AGENTS: opt(z.string().default("degen-scout")),
  // Wall-clock budget for one gateway run. Tool-heavy turns (OHLCV pulls,
  // transaction tapes) routinely pass 2 minutes; the live activity timeline
  // makes the wait legible, so default generously.
  GATEWAY_RUN_TIMEOUT_MS: opt(z.coerce.number().int().positive().default(300_000)),
  // Auth. JWT_SECRET signs our own session token (required, fail-fast).
  // Privy creds are optional so the app boots without them; the Privy login
  // route errors only when actually hit unconfigured.
  JWT_SECRET: z.string().min(1, "JWT_SECRET is required"),
  PRIVY_APP_ID: opt(z.string().min(1).optional()),
  PRIVY_APP_SECRET: opt(z.string().min(1).optional()),
  // GitHub PAT for importing skills from public repos. Optional — anon GitHub
  // API is 60 req/hr, a token raises it. Fine-grained, public repo read is enough.
  GITHUB_TOKEN: opt(z.string().min(1).optional()),
  // On-chain provenance (OCCA registry program, devnet). Anchoring activates
  // only when company PDA + both keypair paths are set; without them the app
  // runs fully off-chain.
  ONCHAIN_RPC_URL: opt(z.string().url().default("https://api.devnet.solana.com")),
  ONCHAIN_REGISTRY_PROGRAM_ID: opt(
    z.string().min(32).default("occaTHMv5eYG5aZ85jimxTvHkBfsDCvndXC6J2k8kxr"),
  ),
  ONCHAIN_TREASURY_PROGRAM_ID: opt(
    z.string().min(32).default("occaxyVLnurdjedWCBPrvDCCto8wGYadtTZ3nAmcVzh"),
  ),
  ONCHAIN_COMPANY_PDA: opt(z.string().min(32).optional()),
  ONCHAIN_OWNER_KEYPAIR: opt(z.string().min(1).optional()),
  ONCHAIN_ANCHOR_KEYPAIR: opt(z.string().min(1).optional()),
  // $OCCA holder gating (token doc). The mint lives on mainnet (pump.fun) —
  // a separate RPC from the devnet provenance block above. Gating activates
  // only when TOKEN_GATE_ENABLED=1; otherwise standing still computes (badge
  // works) but chat/publish stay open, so local dev needs no holdings.
  TOKEN_GATE_ENABLED: opt(z.coerce.number().int().min(0).max(1).default(0)),
  TOKEN_MINT: opt(
    z.string().min(32).default("GYSHDDoVtFNdzR72SSkmJcKWFVh9ndhMdYoDKdg8pump"),
  ),
  TOKEN_RPC_URL: opt(z.string().url().default("https://api.mainnet-beta.solana.com")),
  TOKEN_TOTAL_SUPPLY: opt(z.coerce.number().positive().default(1_000_000_000)),
  // How long a balance snapshot stays fresh before standing re-reads the chain.
  TOKEN_CACHE_TTL_MS: opt(z.coerce.number().int().positive().default(600_000)),
  // Dev/admin wallets (CSV): unmetered, bypass hold + budget gates.
  DEV_WALLETS: opt(z.string().default("")),
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
    allowedAgents: csv(e.ALLOWED_AGENTS),
    gatewayRunTimeoutMs: e.GATEWAY_RUN_TIMEOUT_MS,
    jwtSecret: e.JWT_SECRET,
    privyAppId: e.PRIVY_APP_ID,
    privyAppSecret: e.PRIVY_APP_SECRET,
    githubToken: e.GITHUB_TOKEN,
    onchain: {
      rpcUrl: e.ONCHAIN_RPC_URL,
      registryProgramId: e.ONCHAIN_REGISTRY_PROGRAM_ID,
      treasuryProgramId: e.ONCHAIN_TREASURY_PROGRAM_ID,
      companyPda: e.ONCHAIN_COMPANY_PDA,
      ownerKeypairPath: e.ONCHAIN_OWNER_KEYPAIR,
      anchorKeypairPath: e.ONCHAIN_ANCHOR_KEYPAIR,
      enabled: Boolean(
        e.ONCHAIN_COMPANY_PDA && e.ONCHAIN_OWNER_KEYPAIR && e.ONCHAIN_ANCHOR_KEYPAIR,
      ),
    },
    token: {
      gateEnabled: e.TOKEN_GATE_ENABLED === 1,
      mint: e.TOKEN_MINT,
      rpcUrl: e.TOKEN_RPC_URL,
      totalSupply: e.TOKEN_TOTAL_SUPPLY,
      cacheTtlMs: e.TOKEN_CACHE_TTL_MS,
      devWallets: csv(e.DEV_WALLETS),
    },
  } as const;
}

export const env = loadEnv();
export type Env = ReturnType<typeof loadEnv>;
