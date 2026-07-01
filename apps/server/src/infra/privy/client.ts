/*
  Lazy Privy client singleton. Throws privy_not_configured if the creds are
  missing, so the rest of the app boots fine without Privy — only the login
  route fails when actually hit unconfigured.
*/

import { PrivyClient } from "@privy-io/server-auth";
import { env } from "../../config/env";

let client: PrivyClient | null = null;

export function getPrivyClient(): PrivyClient {
  if (!env.privyAppId || !env.privyAppSecret) {
    throw new Error("privy_not_configured");
  }
  if (!client) client = new PrivyClient(env.privyAppId, env.privyAppSecret);
  return client;
}
