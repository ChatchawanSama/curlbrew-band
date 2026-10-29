import { and, asc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { liveSessions, sessionQueueItems } from "@/db/schema";
import { isAdminAuthenticated } from "@/lib/admin-auth";

export async function POST(request: Request, { params }: { params: Promise<{ roomCode: string }> }) {
  const { roomCode } = await params;
  const db = getDb();
  const [session] = await db.select({ id: liveSessions.id, managementSecretHash: liveSessions.managementSecretHash, status: liveSessions.status }).from(liveSessions).where(eq(liveSessions.code, roomCode)).limit(1);
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Admin authentication required" }, { status: 403 });
  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql`select id from live_sessions where id = ${session.id} for update`);
      const [current] = await tx.select({ status: liveSessions.status }).from(liveSessions).where(eq(liveSessions.id, session.id)).limit(1);
      if (current?.status === "completed" || current?.status === "in_progress") return;
      await tx.update(liveSessions).set({ status: "in_progress", updatedAt: new Date() }).where(eq(liveSessions.id, session.id));
      const [playing] = await tx.select({ id: sessionQueueItems.id }).from(sessionQueueItems).where(and(eq(sessionQueueItems.sessionId, session.id), eq(sessionQueueItems.status, "playing"))).limit(1);
      if (playing) return;
      const [first] = await tx.select({ id: sessionQueueItems.id }).from(sessionQueueItems).where(and(eq(sessionQueueItems.sessionId, session.id), eq(sessionQueueItems.status, "queued"))).orderBy(asc(sessionQueueItems.queueOrder), asc(sessionQueueItems.id)).limit(1);
      if (first) await tx.update(sessionQueueItems).set({ status: "playing", updatedAt: new Date() }).where(eq(sessionQueueItems.id, first.id));
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not start session" }, { status: 409 });
  }
}
