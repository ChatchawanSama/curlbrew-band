import { headers } from "next/headers";
import { auth } from "./auth";

export async function getMember() {
  if (!auth) return null;
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
}

export async function requireMember() {
  const member = await getMember();
  if (!member) throw new Error("Authentication required");
  return member;
}
