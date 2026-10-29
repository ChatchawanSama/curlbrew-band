import { NextResponse } from "next/server";
import { z } from "zod";
import { credentialsMatch, createAdminCookieValue, getAdminCookieName, isLoginRateLimited } from "@/lib/admin-auth";

const input = z.object({ username: z.string().trim().min(1).max(120), password: z.string().min(1).max(200) });

export async function POST(request: Request) {
  const identifier = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (isLoginRateLimited(identifier)) return NextResponse.json({ error: "Too many login attempts. Try again later." }, { status: 429 });
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !credentialsMatch(parsed.data?.username ?? "", parsed.data?.password ?? "")) return NextResponse.json({ error: "Invalid admin credentials." }, { status: 401 });
  const response = NextResponse.json({ authenticated: true });
  response.cookies.set({ name: getAdminCookieName(), value: createAdminCookieValue(), httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 7, path: "/" });
  return response;
}
