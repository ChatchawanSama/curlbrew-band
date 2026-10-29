import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

const globalForDb = globalThis as typeof globalThis & { curlbrewPool?: Pool };

export function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  const pool = globalForDb.curlbrewPool ?? new Pool({ connectionString: url, max: 1 });
  globalForDb.curlbrewPool = pool;
  return drizzle(pool, { schema });
}
