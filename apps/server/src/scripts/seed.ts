/*
  Seed the catalog with the OCCA-operated seed agents. Idempotent — re-running
  refreshes each seed row from the source data. Run: pnpm db:seed.
*/

import "dotenv/config";
import { db } from "../infra/database/client";
import { agents, type NewAgentRow } from "../infra/database/schema";
import { SEED_AGENTS } from "../features/agents/data/catalog";
import { AGENT_DETAILS, fallbackDetail } from "../features/agents/data/details";

async function main() {
  const rows: NewAgentRow[] = SEED_AGENTS.map((a) => ({
    ...a,
    detail: AGENT_DETAILS[a.id] ?? fallbackDetail(a),
  }));

  for (const row of rows) {
    const { id, ...rest } = row;
    await db
      .insert(agents)
      .values(row)
      .onConflictDoUpdate({ target: agents.id, set: rest });
  }

  console.log(`[db] seeded ${rows.length} agents`);
  process.exit(0);
}

main().catch((err) => {
  console.error("[db] seed failed:", err);
  process.exit(1);
});
