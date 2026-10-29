import { and, asc, eq, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { liveSessions, songRequests, songs } from "@/db/schema";
import { requestInput } from "@/lib/live";

export const dynamic = "force-dynamic";

export async function GET(_: NextRequest, { params }: { params: Promise<{ sessionCode: string }> }) {
  const { sessionCode } = await params;
  const db = getDb();
  const [session] = await db.select().from(liveSessions).where(eq(liveSessions.code, sessionCode)).limit(1);
  if (!session) return NextResponse.json({ error: "Live session not found" }, { status: 404 });
  const requests = await db.select({ id: songRequests.id, songId: songRequests.songId, title: songs.title, artist: songs.artist, nickname: songRequests.nickname, status: songRequests.status, createdAt: songRequests.createdAt, queuePosition: songRequests.queuePosition }).from(songRequests).innerJoin(songs, eq(songRequests.songId, songs.id)).where(eq(songRequests.sessionId, session.id)).orderBy(asc(songRequests.queuePosition), asc(songRequests.createdAt));
  const requestableSongs = await db.select({ id: songs.id, title: songs.title, artist: songs.artist, key: songs.preferredKey }).from(songs).where(eq(songs.audienceRequestable, true)).orderBy(asc(songs.title));
  const nowPlaying = requests.find((request) => request.status === "playing") ?? null;
  return NextResponse.json({ session: { ...session, nowPlaying }, requests, songs: requestableSongs }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ sessionCode: string }> }) {
  const { sessionCode } = await params;
  const parsed = requestInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a nickname and choose a song." }, { status: 400 });
  const db = getDb();
  const [session] = await db.select().from(liveSessions).where(eq(liveSessions.code, sessionCode)).limit(1);
  if (!session || session.status === "completed") return NextResponse.json({ error: "This session has ended." }, { status: 410 });
  if (!session.requestsOpen) return NextResponse.json({ error: "Requests are paused for now." }, { status: 409 });
  const [song] = await db.select({ id: songs.id }).from(songs).where(and(eq(songs.id, parsed.data.songId), eq(songs.audienceRequestable, true))).limit(1);
  if (!song) return NextResponse.json({ error: "That song is not available for requests." }, { status: 400 });
  const recentDuplicate = await db.select({ id: songRequests.id }).from(songRequests).where(and(eq(songRequests.sessionId, session.id), eq(songRequests.songId, song.id), eq(songRequests.status, "pending"))).limit(1);
  if (recentDuplicate.length) return NextResponse.json({ error: "That song is already waiting for approval." }, { status: 409 });
  const [created] = await db.insert(songRequests).values({ sessionId: session.id, songId: song.id, nickname: parsed.data.nickname }).returning();
  return NextResponse.json({ request: created }, { status: 201 });
}
