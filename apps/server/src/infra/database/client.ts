/*
  The one shared Drizzle client. Repositories import `db` from here; nothing
  else opens a pool. Connection comes from the validated env singleton.
*/

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "../../config/env";
import * as schema from "./schema";

const pool = new Pool({ connectionString: env.databaseUrl });

export const db = drizzle(pool, { schema });
