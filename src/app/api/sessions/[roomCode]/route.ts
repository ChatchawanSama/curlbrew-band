import { asc, eq, and, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { liveSessions, sessionQueueItems, songs } from "@/db/schema";
import { hasRoomAccess } from "@/lib/session-room";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { z } from "zod";

export async function GET(request: Request, { params }: { params: Promise<{ roomCode: string }> }) {
  const { roomCode } = await params; const db = getDb();
  const [session] = await db.select({ id: liveSessions.id, code: liveSessions.code, name: liveSessions.name, scheduledAt: liveSessions.scheduledAt, status: liveSessions.status, managementSecretHash: liveSessions.managementSecretHash }).from(liveSessions).where(eq(liveSessions.code, roomCode)).limit(1);
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  if (session.status === "scheduled" && session.scheduledAt && session.scheduledAt.getTime() <= Date.now()) {
    await db.transaction(async (tx) => {
      await tx.execute(sql`select id from live_sessions where id = ${session.id} for update`);
      const [current] = await tx.select({ status: liveSessions.status }).from(liveSessions).where(eq(liveSessions.id, session.id)).limit(1);
      if (current?.status !== "scheduled") return;
      await tx.update(liveSessions).set({ status: "in_progress", updatedAt: new Date() }).where(eq(liveSessions.id, session.id));
      const [first] = await tx.select({ id: sessionQueueItems.id }).from(sessionQueueItems).where(and(eq(sessionQueueItems.sessionId, session.id), eq(sessionQueueItems.status, "queued"))).orderBy(asc(sessionQueueItems.queueOrder), asc(sessionQueueItems.id)).limit(1);
      if (first) await tx.update(sessionQueueItems).set({ status: "playing", updatedAt: new Date() }).where(eq(sessionQueueItems.id, first.id));
    });
    session.status = "in_progress";
  }
  const queue = await db.select({ id: sessionQueueItems.id, songId: sessionQueueItems.songId, title: songs.title, artist: sessionQueueItems.entryArtist, libraryArtist: songs.artist, preferredKey: sessionQueueItems.entryKey, libraryKey: songs.preferredKey, notes: sessionQueueItems.entryNote, libraryNotes: songs.notes, chordUrl: sessionQueueItems.entryChordUrl, requestedNickname: sessionQueueItems.requestedNickname, queueOrder: sessionQueueItems.queueOrder, position: sessionQueueItems.position, status: sessionQueueItems.status }).from(sessionQueueItems).innerJoin(songs, eq(sessionQueueItems.songId, songs.id)).where(eq(sessionQueueItems.sessionId, session.id)).orderBy(asc(sessionQueueItems.queueOrder), asc(sessionQueueItems.id));
  const isManager = hasRoomAccess(session.managementSecretHash, request.headers.get("x-room-key"));
  const requests: Array<never> = [];
  return NextResponse.json({ session: { id: session.id, code: session.code, name: session.name, scheduledAt: session.scheduledAt, status: session.status }, queue, requests, isManager }, { headers: { "Cache-Control": "no-store" } });
}

const updateSessionInput = z.object({ name: z.string().trim().min(1).max(120).optional(), scheduledAt: z.string().datetime().nullable().optional() }).refine((value) => value.name !== undefined || value.scheduledAt !== undefined, "Nothing to update.");

export async function PATCH(request: Request, { params }: { params: Promise<{ roomCode: string }> }) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Admin authentication required." }, { status: 401 });
  const parsed = updateSessionInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid session details." }, { status: 400 });
  const { roomCode } = await params;
  const [session] = await getDb().update(liveSessions).set({ ...(parsed.data.name === undefined ? {} : { name: parsed.data.name }), ...(parsed.data.scheduledAt === undefined ? {} : { scheduledAt: parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : null }), updatedAt: new Date() }).where(eq(liveSessions.code, roomCode)).returning({ id: liveSessions.id, code: liveSessions.code, name: liveSessions.name, scheduledAt: liveSessions.scheduledAt, status: liveSessions.status });
  if (!session) return NextResponse.json({ error: "Session not found." }, { status: 404 });
  return NextResponse.json(session);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ roomCode: string }> }) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Admin authentication required." }, { status: 401 });
  const { roomCode } = await params;
  const [deleted] = await getDb().delete(liveSessions).where(eq(liveSessions.code, roomCode)).returning({ id: liveSessions.id });
  if (!deleted) return NextResponse.json({ error: "Session not found." }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
