import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { chordSources, liveSessions, sessionQueueItems, songs } from "@/db/schema";

const addQueueInput = z.object({ songId: z.string().uuid().optional(), title: z.string().trim().min(1).max(160).optional(), artist: z.string().trim().max(160).nullable().optional(), preferredKey: z.string().trim().max(12).nullable().optional(), notes: z.string().trim().max(5000).nullable().optional(), chordUrl: z.string().url().nullable().optional(), requestToken: z.string().trim().max(80).optional(), requestedNickname: z.string().trim().max(40).optional() }).refine((value) => value.songId || value.title, "Choose a song or enter a title.");

export async function POST(request: Request, { params }: { params: Promise<{ roomCode: string }> }) {
  const { roomCode } = await params; const db = getDb();
  const [session] = await db.select({ id: liveSessions.id, managementSecretHash: liveSessions.managementSecretHash, status: liveSessions.status }).from(liveSessions).where(eq(liveSessions.code, roomCode)).limit(1);
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  if (session.status === "completed") return NextResponse.json({ error: "This session has ended" }, { status: 409 });
  const parsed = addQueueInput.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid song" }, { status: 400 });
  let item;
  try {
    item = await db.transaction(async (tx) => {
    await tx.execute(sql`select id from live_sessions where id = ${session.id} for update`);
    if (parsed.data.requestToken) {
      const [existing] = await tx.select().from(sessionQueueItems).where(and(eq(sessionQueueItems.sessionId, session.id), eq(sessionQueueItems.requestToken, parsed.data.requestToken))).limit(1);
      if (existing) return existing;
    }
    let songId = parsed.data.songId;
    if (!songId) {
      const [created] = await tx.insert(songs).values({ title: parsed.data.title!, artist: parsed.data.artist || null, preferredKey: parsed.data.preferredKey || null, notes: parsed.data.notes || null, createdBy: null }).returning({ id: songs.id });
      songId = created.id;
      if (parsed.data.chordUrl) await tx.insert(chordSources).values({ songId, label: "Chord link", externalUrl: parsed.data.chordUrl, isPreferred: true, createdBy: null });
    }
    const max = await tx.execute<{ max: string | number | null }>(sql`select max(queue_order) as max from session_queue_items where session_id = ${session.id}`);
    const maxOrder = Number(max.rows[0]?.max ?? 0);
    const nextOrder = Math.max(Date.now(), maxOrder + 1);
    const positionMax = await tx.execute<{ max: number | null }>(sql`select max(position)::int as max from session_queue_items where session_id = ${session.id}`);
    const [created] = await tx.insert(sessionQueueItems).values({ sessionId: session.id, songId, entryArtist: parsed.data.artist || null, entryKey: parsed.data.preferredKey || null, entryNote: parsed.data.notes || null, entryChordUrl: parsed.data.chordUrl || null, requestedNickname: parsed.data.requestedNickname || null, requestToken: parsed.data.requestToken || null, queueOrder: nextOrder, position: (positionMax.rows[0]?.max ?? 0) + 1, status: session.status === "in_progress" && !(await tx.select({ id: sessionQueueItems.id }).from(sessionQueueItems).where(and(eq(sessionQueueItems.sessionId, session.id), eq(sessionQueueItems.status, "playing"))).limit(1)).length ? "playing" : "queued" }).returning();
      return created;
    });
  } catch (error) {
    console.error("Failed to add session queue item", error);
    return NextResponse.json({ error: "Could not add song to the queue.", detail: process.env.NODE_ENV === "development" && error instanceof Error ? error.message : undefined }, { status: 500 });
  }
  return NextResponse.json(item, { status: 201 });
}
