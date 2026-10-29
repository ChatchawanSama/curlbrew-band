import { and, asc, desc, eq, ilike, or } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { chordSources, songs } from "@/db/schema";
import { z } from "zod";

const songInput = z.object({ title: z.string().trim().min(1).max(160), artist: z.string().trim().max(160).nullable().optional(), bpm: z.number().int().min(20).max(300).nullable().optional(), genre: z.string().trim().max(80).nullable().optional(), notes: z.string().trim().max(5000).nullable().optional(), chordUrl: z.string().url().max(2000).nullable().optional(), audienceRequestable: z.boolean().default(true) });

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const db = getDb(); const rows = await db.select({ id: songs.id, title: songs.title, artist: songs.artist, preferredKey: songs.preferredKey, bpm: songs.bpm, genre: songs.genre, notes: songs.notes, audienceRequestable: songs.audienceRequestable, createdBy: songs.createdBy, chordUrl: chordSources.externalUrl, createdAt: songs.createdAt, updatedAt: songs.updatedAt }).from(songs).leftJoin(chordSources, and(eq(chordSources.songId, songs.id), eq(chordSources.isPreferred, true))).where(query ? or(ilike(songs.title, `%${query}%`), ilike(songs.artist, `%${query}%`)) : undefined).orderBy(desc(songs.updatedAt), asc(songs.title)); return NextResponse.json(rows);
}

export async function POST(request: NextRequest) {
  const parsed = songInput.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "Invalid song details", issues: parsed.error.flatten() }, { status: 400 });
  const { chordUrl, ...songData } = parsed.data;
  const db = getDb();
  const song = await db.transaction(async (tx) => {
    const [created] = await tx.insert(songs).values({ ...songData, createdBy: null }).returning();
    if (chordUrl) await tx.insert(chordSources).values({ songId: created.id, label: "Chord link", externalUrl: chordUrl, isPreferred: true, createdBy: null });
    return created;
  });
  return NextResponse.json({ ...song, chordUrl: chordUrl ?? null }, { status: 201 });
}
