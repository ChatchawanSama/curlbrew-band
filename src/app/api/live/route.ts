import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { liveSessions } from "@/db/schema";
import { env } from "@/lib/env";
import { requireMember } from "@/lib/server-auth";
import { z } from "zod";

const createSession = z.object({ name: z.string().trim().min(1).max(120) });
function makeCode() { return Math.random().toString(36).slice(2, 8).toUpperCase(); }

export async function POST(request: Request) {
  const member = await requireMember().catch(() => null); if (!member) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const parsed = createSession.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "A session name is required" }, { status: 400 });
  const db = getDb(); let code = makeCode();
  for (let attempt = 0; attempt < 4; attempt++) { const exists = await db.select({ id: liveSessions.id }).from(liveSessions).where(eq(liveSessions.code, code)).limit(1); if (!exists.length) break; code = makeCode(); }
  const [session] = await db.insert(liveSessions).values({ code, name: parsed.data.name, createdBy: member.id }).returning({ id: liveSessions.id, code: liveSessions.code, name: liveSessions.name });
  return NextResponse.json(session, { status: 201 });
}
