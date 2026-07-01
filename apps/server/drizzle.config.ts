import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/infra/database/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // Only used by migrate/push/introspect; `generate` diffs the schema offline.
    url: process.env.DATABASE_URL ?? "postgres://localhost:5432/placeholder",
  },
});
