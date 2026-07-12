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
  // Envelope-encryption master key for the secret-bearing agent columns
  // (tool_configs, runtime). 32 bytes as base64 or hex. Optional so local dev
  // boots without it (secrets fall back to plaintext with a warning);
  // production MUST set it. Generate: `openssl rand -base64 32`.
  SECRETS_MASTER_KEY: opt(z.string().min(1).optional()),
  // Auth. JWT_SECRET signs our own session token (required, fail-fast). Min 32
  // chars so the HS256 key isn't brute-forceable — every ownership check hangs
  // off this token. Privy creds are optional so the app boots without them; the
  // Privy login route errors only when actually hit unconfigured.
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
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
  // First-party MCP toolbox — where apps/mcp-tools lives ON THE GATEWAY BOX.
  // The tool catalog bakes this path into seed-agent .mcp.json configs, so it
  // must be the path the gateway's `node` resolves, not a path on this host.
  MCP_TOOLS_DIR: opt(z.string().default("/opt/occa/mcp-tools")),
  // Gateway that runs OCCA's own seed agents (the db:seed script). Optional —
  // without them seeding fails fast with a readable message instead of at boot.
  SEED_GATEWAY_URL: opt(z.string().url().optional()),
  SEED_GATEWAY_API_KEY: opt(z.string().min(1).optional()),
  // Paid-usage credits (USDC, mainnet — same RPC as the token block).
  // Deposits only activate once the market's receiving wallet is set.
  DEPOSIT_WALLET: opt(z.string().min(32).optional()),
  USDC_MINT: opt(
    z.string().min(32).default("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"),
  ),
  // x402 machine-payment rail (blueprint §6). Pays into DEPOSIT_WALLET, so it
  // activates with the same switch as credits. The facilitator verifies and
  // settles payment transactions; the network is CAIP-2 (Solana mainnet).
  X402_FACILITATOR_URL: opt(
    z.string().url().default("https://facilitator.payai.network"),
  ),
  X402_NETWORK: opt(
    z.string().min(3).default("solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"),
  ),
  // Settlement program (occa-market-programs) — non-custodial per-agent USDC
  // vaults. When set, x402 payments route to an agent's vault instead of the
  // treasury wallet, and the split happens on-chain at claim. Runs on the same
  // RPC as the provenance block (ONCHAIN_RPC_URL). Unset → phase-1 treasury.
  SETTLEMENT_PROGRAM_ID: opt(z.string().min(32).optional()),
  SETTLEMENT_AUTHORITY_KEYPAIR: opt(z.string().min(1).optional()),
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
    secretsMasterKey: e.SECRETS_MASTER_KEY ?? null,
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
    mcpToolsDir: e.MCP_TOOLS_DIR,
    seedGateway: {
      url: e.SEED_GATEWAY_URL ?? null,
      apiKey: e.SEED_GATEWAY_API_KEY ?? null,
    },
    credits: {
      depositWallet: e.DEPOSIT_WALLET ?? null,
      usdcMint: e.USDC_MINT,
      enabled: Boolean(e.DEPOSIT_WALLET),
    },
    x402: {
      facilitatorUrl: e.X402_FACILITATOR_URL,
      network: e.X402_NETWORK,
      enabled: Boolean(e.DEPOSIT_WALLET),
    },
    settlement: {
      programId: e.SETTLEMENT_PROGRAM_ID ?? null,
      authorityKeypairPath: e.SETTLEMENT_AUTHORITY_KEYPAIR ?? null,
      enabled: Boolean(e.SETTLEMENT_PROGRAM_ID && e.SETTLEMENT_AUTHORITY_KEYPAIR),
    },
  } as const;
}

export const env = loadEnv();
export type Env = ReturnType<typeof loadEnv>;
