/*
  Privy login — verify the Privy access token, read the linked wallet/email,
  upsert the user, and mint our own session JWT. This is the only place Privy is
  exchanged; every later request carries our JWT, not the Privy token.
*/

import type { PrivyClient } from "@privy-io/server-auth";
import type { AuthResponse } from "@occa-market/shared";
import { getPrivyClient } from "../../../infra/privy/client";
import { signToken } from "../../../middleware/auth";
import { toAuthUser } from "../domain/dtos";
import { pickEmail, pickWallet } from "../domain/privy";
import { upsertUserByPrivyDid } from "../repositories/users";

type LoginResult =
  | { ok: true; data: AuthResponse }
  | { ok: false; status: number; error: string };

export async function loginWithPrivy(accessToken: string): Promise<LoginResult> {
  let privy: PrivyClient;
  try {
    privy = getPrivyClient();
  } catch {
    return { ok: false, status: 503, error: "auth not configured" };
  }

  let userId: string;
  try {
    ({ userId } = await privy.verifyAuthToken(accessToken));
  } catch {
    return { ok: false, status: 401, error: "invalid privy token" };
  }

  const pUser = await privy.getUser(userId);
  const row = await upsertUserByPrivyDid({
    privyDid: userId,
    walletAddress: pickWallet(pUser),
    email: pickEmail(pUser),
  });

  const token = signToken({ userId: row.id, privyDid: row.privyDid });
  return { ok: true, data: { token, user: toAuthUser(row) } };
}
