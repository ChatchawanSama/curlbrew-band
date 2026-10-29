import { migrate } from "drizzle-orm/neon-serverless/migrator";
import { getDb } from "./index";

async function main() {
  await migrate(getDb(), { migrationsFolder: "./drizzle" });
  console.log("Migrations applied.");
}

void main();
