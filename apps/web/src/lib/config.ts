/*
  Web-side config, read from NEXT_PUBLIC_* env (safe on server and client).
  The ONE place the web reads env — components import `config`, not process.env.
*/

const welcomeCredit = Number(process.env.NEXT_PUBLIC_WELCOME_CREDIT);

const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";

// Dev/admin wallets that bypass the chat credit gate (CSV). Client-side
// display logic only — the real enforcement moves server-side with the ledger.
const devWallets = (process.env.NEXT_PUBLIC_DEV_WALLETS ?? "")
  .split(",")
  .map((w) => w.trim())
  .filter(Boolean);

export const config = {
  /** Base URL of the API server (apps/server). */
  apiBaseUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000",
  /** Display-only welcome credit the chat seeds (server holds the real ledger). */
  welcomeCredit: Number.isFinite(welcomeCredit) ? welcomeCredit : 0.5,
  /** Privy app id (public). Empty string disables sign-in gracefully. */
  privyAppId,
  /** Whether Privy sign-in is configured. */
  privyEnabled: privyAppId.length > 0,
  /** Wallets exempt from the credit gate (dev/admin). */
  devWallets,
} as const;
