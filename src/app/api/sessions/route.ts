import { asc, desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { liveSessions } from "@/db/schema";
import { createRoomCode, createRoomSecret, hashRoomSecret } from "@/lib/session-room";
import { isAdminAuthenticated } from "@/lib/admin-auth";

const createSessionInput = z.object({ name: z.string().trim().max(120).default("Rehearsal"), scheduledAt: z.string().datetime() });

export async function GET() {
  const rows = await getDb().select({ id: liveSessions.id, code: liveSessions.code, name: liveSessions.name, scheduledAt: liveSessions.scheduledAt, status: liveSessions.status, createdAt: liveSessions.startedAt }).from(liveSessions).orderBy(desc(liveSessions.scheduledAt), desc(liveSessions.startedAt));
  return NextResponse.json(rows, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Admin authentication required." }, { status: 401 });
  const parsed = createSessionInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a date and time for the session." }, { status: 400 });
  const secret = createRoomSecret();
  const [session] = await getDb().insert(liveSessions).values({ code: createRoomCode(), name: parsed.data.name || "Rehearsal", scheduledAt: new Date(parsed.data.scheduledAt), status: "scheduled", managementSecretHash: hashRoomSecret(secret), createdBy: null }).returning({ id: liveSessions.id, code: liveSessions.code, name: liveSessions.name, scheduledAt: liveSessions.scheduledAt });
  return NextResponse.json({ ...session, managementUrl: `/session/${session.code}?key=${secret}`, audienceUrl: `/session/${session.code}/request` }, { status: 201 });
}
