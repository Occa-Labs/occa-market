/*
  Web-side config, read from NEXT_PUBLIC_* env (safe on server and client).
  The ONE place the web reads env — components import `config`, not process.env.
*/

const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";

// Dev/admin wallets that bypass the chat credit gate (CSV). Client-side
// display logic only — the real enforcement moves server-side with the ledger.
const devWallets = (process.env.NEXT_PUBLIC_DEV_WALLETS ?? "")
  .split(",")
  .map((w) => w.trim())
  .filter(Boolean);

export const config = {
  /**
   * Base URL of the API server (apps/server). Server-side rendering may
   * override with API_URL_INTERNAL (runtime env, never inlined into the
   * bundle) to reach the API directly on localhost; browsers always use the
   * public URL baked in at build time.
   */
  apiBaseUrl:
    (typeof window === "undefined" ? process.env.API_URL_INTERNAL : undefined) ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:4000",
  /** Privy app id (public). Empty string disables sign-in gracefully. */
  privyAppId,
  /** Whether Privy sign-in is configured. */
  privyEnabled: privyAppId.length > 0,
  /** Wallets exempt from the credit gate (dev/admin). */
  devWallets,
  /** Where "Get $OCCA" points — the token's live venue. */
  occaTokenUrl:
    process.env.NEXT_PUBLIC_OCCA_TOKEN_URL ??
    "https://pump.fun/coin/GYSHDDoVtFNdzR72SSkmJcKWFVh9ndhMdYoDKdg8pump",
} as const;
