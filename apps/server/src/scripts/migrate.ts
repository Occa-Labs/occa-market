/* Apply pending Drizzle migrations against DATABASE_URL. Run: pnpm db:migrate. */

import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { env } from "../config/env";

async function main() {
  const pool = new Pool({ connectionString: env.databaseUrl });
  const db = drizzle(pool);
  await migrate(db, { migrationsFolder: "./drizzle" });
  await pool.end();
  console.log("[db] migrations applied");
}

main().catch((err) => {
  console.error("[db] migration failed:", err);
  process.exit(1);
});
