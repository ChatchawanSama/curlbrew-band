import { betterAuth } from "better-auth";
import { admin, username } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getDb } from "@/db";
import * as schema from "@/db/schema";
import { env } from "./env";

export const auth = env.DATABASE_URL && env.BETTER_AUTH_SECRET ? betterAuth({
  database: drizzleAdapter(getDb(), { provider: "pg", schema }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  emailAndPassword: { enabled: true, disableSignUp: true },
  plugins: [username({ immutableUsername: true, displayUsername: false }), admin()],
}) : null;
