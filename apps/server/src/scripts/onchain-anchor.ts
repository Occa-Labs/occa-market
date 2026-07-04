/*
  Manual on-chain sweep — the same pass the boot scheduler runs hourly:
  register any agents missing their identity/deployment, then anchor every
  complete unanchored UTC day. For ops and testing outside the server.

  Run from apps/server: pnpm onchain:anchor
*/

import { onchainEnabled } from "../infra/onchain/client";
import {
  registerMissingAgents,
  runDailyAnchors,
} from "../features/agents/services/onchain";

async function main() {
  if (!onchainEnabled()) {
    throw new Error("onchain env not configured — run pnpm onchain:bootstrap first");
  }
  const registered = await registerMissingAgents();
  const anchored = await runDailyAnchors();
  console.log(`\nregistered ${registered} agent(s), committed ${anchored} day anchor(s)`);
  process.exit(0);
}

main().catch((err) => {
  console.error("sweep failed:", err);
  process.exit(1);
});
