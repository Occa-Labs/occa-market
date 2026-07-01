/*
  Web-side config, read from NEXT_PUBLIC_* env (safe on server and client).
  The ONE place the web reads env — components import `config`, not process.env.
*/

const welcomeCredit = Number(process.env.NEXT_PUBLIC_WELCOME_CREDIT);

const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";

export const config = {
  /** Base URL of the API server (apps/server). */
  apiBaseUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000",
  /** Display-only welcome credit the chat seeds (server holds the real ledger). */
  welcomeCredit: Number.isFinite(welcomeCredit) ? welcomeCredit : 0.5,
  /** Privy app id (public). Empty string disables sign-in gracefully. */
  privyAppId,
  /** Whether Privy sign-in is configured. */
  privyEnabled: privyAppId.length > 0,
} as const;
