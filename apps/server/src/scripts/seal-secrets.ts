/*
  One-time backfill: encrypt existing plaintext agent secrets at rest.

  Run once after setting SECRETS_MASTER_KEY on a database that predates
  encryption: `pnpm --filter @occa-market/server secrets:seal`. Idempotent —
  rows already sealed are skipped, so re-running is safe.

  Reads rows raw (not through the repo, which would open them) and writes the
  sealed value straight back into the same column.
*/

import "dotenv/config";
import { eq } from "drizzle-orm";
import { env } from "../config/env";
import { db } from "../infra/database/client";
import { agents } from "../infra/database/schema";
import { encryptSecret, isEncrypted } from "../infra/crypto/secrets";

async function main(): Promise<void> {
  if (!env.secretsMasterKey) {
    console.error(
      "SECRETS_MASTER_KEY is not set — nothing to seal against. Set it first.",
    );
    process.exit(1);
  }

  const rows = await db.select().from(agents);
  let sealed = 0;
  for (const row of rows) {
    const needsTools = !isEncrypted(row.toolConfigs);
    const needsRuntime = row.runtime != null && !isEncrypted(row.runtime);
    if (!needsTools && !needsRuntime) continue;
    await db
      .update(agents)
      .set({
        toolConfigs: encryptSecret(row.toolConfigs) as typeof row.toolConfigs,
        runtime: encryptSecret(row.runtime) as typeof row.runtime,
      })
      .where(eq(agents.id, row.id));
    sealed++;
    console.log(`✓ sealed ${row.id}`);
  }
  console.log(`[crypto] backfill done — ${sealed}/${rows.length} row(s) sealed`);
  process.exit(0);
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
