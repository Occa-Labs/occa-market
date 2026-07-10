/*
  x402 v2 wire types — the subset of the protocol this server speaks
  (spec: coinbase/x402 specs/x402-specification-v2.md + scheme_exact_svm.md).
  These shapes cross the wire to x402 clients and the facilitator, so field
  names are protocol-fixed; do not rename to house style.
*/

export const X402_VERSION = 2;

/** One acceptable way to pay — the `exact` SVM scheme in our case. */
export type PaymentRequirements = {
  scheme: "exact";
  /** CAIP-2 network id, e.g. solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp */
  network: string;
  /** Atomic token units (USDC has 6 decimals, so this is micro-USD). */
  amount: string;
  /** Token mint address. */
  asset: string;
  /** Recipient wallet — the market's deposit wallet. */
  payTo: string;
  maxTimeoutSeconds: number;
  extra: {
    /** Who co-signs and pays gas — the facilitator's signer. */
    feePayer: string;
  };
};

/** The 402 body / PAYMENT-REQUIRED header payload. */
export type PaymentRequired = {
  x402Version: typeof X402_VERSION;
  error?: string;
  resource: { url: string; description?: string; mimeType?: string };
  accepts: PaymentRequirements[];
};

/** The PAYMENT-SIGNATURE header payload (client → server). */
export type PaymentPayload = {
  x402Version: number;
  resource?: { url: string; description?: string; mimeType?: string };
  accepted: PaymentRequirements;
  payload: {
    /** Base64 partially-signed versioned Solana transaction. */
    transaction: string;
  };
};

export type VerifyResponse = {
  isValid: boolean;
  invalidReason?: string;
  payer?: string;
};

export type SettleResponse = {
  success: boolean;
  errorReason?: string;
  payer?: string;
  /** Base58 transaction signature (empty string on failure). */
  transaction: string;
  network: string;
};
