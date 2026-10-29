import { and, asc, eq, gte, isNull, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { chordSources, liveSessions, sessionQueueItems, songs } from "@/db/schema";

const requestInput = z.object({ songId: z.string().uuid().optional(), title: z.string().trim().min(1).max(160).optional(), artist: z.string().trim().max(160).nullable().optional(), preferredKey: z.string().trim().max(12).nullable().optional(), notes: z.string().trim().max(5000).nullable().optional(), chordUrl: z.string().url().nullable().optional(), requestedNickname: z.string().trim().max(40).optional(), requestToken: z.string().trim().max(80).optional() }).refine((value) => value.songId || value.title, "Choose a song or enter a title.");

export async function POST(request: Request, { params }: { params: Promise<{ roomCode: string }> }) {
  const { roomCode } = await params;
  const parsed = requestInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  const db = getDb();
  const [session] = await db.select({ id: liveSessions.id, status: liveSessions.status, requestsOpen: liveSessions.requestsOpen }).from(liveSessions).where(eq(liveSessions.code, roomCode)).limit(1);
  if (!session || session.status === "completed" || !session.requestsOpen) return NextResponse.json({ error: "Requests are closed" }, { status: 409 });

  try {
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`select id from live_sessions where id = ${session.id} for update`);
      let effectiveStatus = session.status;
      if (session.status === "scheduled") {
        const [current] = await tx.select({ scheduledAt: liveSessions.scheduledAt, status: liveSessions.status }).from(liveSessions).where(eq(liveSessions.id, session.id)).limit(1);
        if (current?.status === "scheduled" && current.scheduledAt && current.scheduledAt.getTime() <= Date.now()) {
          await tx.update(liveSessions).set({ status: "in_progress", updatedAt: new Date() }).where(eq(liveSessions.id, session.id));
          const [first] = await tx.select({ id: sessionQueueItems.id }).from(sessionQueueItems).where(and(eq(sessionQueueItems.sessionId, session.id), eq(sessionQueueItems.status, "queued"))).orderBy(asc(sessionQueueItems.queueOrder), asc(sessionQueueItems.id)).limit(1);
          if (first) await tx.update(sessionQueueItems).set({ status: "playing", updatedAt: new Date() }).where(eq(sessionQueueItems.id, first.id));
          effectiveStatus = "in_progress";
        }
      }
      if (parsed.data.requestToken) {
        const [existing] = await tx.select().from(sessionQueueItems).where(and(eq(sessionQueueItems.sessionId, session.id), eq(sessionQueueItems.requestToken, parsed.data.requestToken))).limit(1);
        if (existing) return { item: existing, duplicate: true };
      }
      let songId = parsed.data.songId;
      let title = parsed.data.title ?? "";
      let artist = parsed.data.artist ?? null;
      if (songId) {
        const [song] = await tx.select({ title: songs.title, artist: songs.artist }).from(songs).where(eq(songs.id, songId)).limit(1);
        if (!song) throw new Error("Song not found");
        title = song.title;
        artist = parsed.data.artist === undefined ? song.artist : parsed.data.artist;
      } else {
        const [existingSong] = await tx.select({ id: songs.id, title: songs.title, artist: songs.artist }).from(songs).where(and(eq(songs.title, title), artist === null ? isNull(songs.artist) : eq(songs.artist, artist))).limit(1);
        if (existingSong) songId = existingSong.id;
        else {
          const [created] = await tx.insert(songs).values({ title, artist, preferredKey: parsed.data.preferredKey || null, notes: parsed.data.notes || null, createdBy: null }).returning({ id: songs.id });
          songId = created.id;
          if (parsed.data.chordUrl) await tx.insert(chordSources).values({ songId, label: "Chord link", externalUrl: parsed.data.chordUrl, isPreferred: true, createdBy: null });
        }
      }
      const since = new Date(Date.now() - 10_000);
      const recent = await tx.select({ id: sessionQueueItems.id }).from(sessionQueueItems).where(and(eq(sessionQueueItems.sessionId, session.id), eq(sessionQueueItems.songId, songId), parsed.data.requestedNickname ? eq(sessionQueueItems.requestedNickname, parsed.data.requestedNickname) : isNull(sessionQueueItems.requestedNickname), gte(sessionQueueItems.createdAt, since))).limit(1);
      if (recent.length) return { item: recent[0], duplicate: true };
      const max = await tx.execute<{ max: string | number | null }>(sql`select max(queue_order) as max from session_queue_items where session_id = ${session.id}`);
      const maxOrder = Number(max.rows[0]?.max ?? 0);
      const nextOrder = Math.max(Date.now(), maxOrder + 1);
      const positionMax = await tx.execute<{ max: number | null }>(sql`select max(position)::int as max from session_queue_items where session_id = ${session.id}`);
      const [item] = await tx.insert(sessionQueueItems).values({ sessionId: session.id, songId, entryArtist: artist, entryKey: parsed.data.preferredKey || null, entryNote: parsed.data.notes || null, entryChordUrl: parsed.data.chordUrl || null, requestedNickname: parsed.data.requestedNickname || null, requestToken: parsed.data.requestToken || null, queueOrder: nextOrder, position: (positionMax.rows[0]?.max ?? 0) + 1, status: effectiveStatus === "in_progress" && !(await tx.select({ id: sessionQueueItems.id }).from(sessionQueueItems).where(and(eq(sessionQueueItems.sessionId, session.id), eq(sessionQueueItems.status, "playing"))).limit(1)).length ? "playing" : "queued" }).returning();
      return { item, duplicate: false };
    });
    return NextResponse.json({ queueItem: result.item, duplicate: result.duplicate }, { status: result.duplicate ? 200 : 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not add request to queue." }, { status: 409 });
  }
}
