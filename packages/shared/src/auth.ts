/* Authenticated user — the public shape the server returns and the web renders. */

export type AuthUser = {
  id: string;
  privyDid: string;
  walletAddress: string | null;
  email: string | null;
  name: string | null;
};
