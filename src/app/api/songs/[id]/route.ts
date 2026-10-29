import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { chordSources, songs } from "@/db/schema";
import { z } from "zod";

const updateInput = z.object({ title: z.string().trim().min(1).max(160).optional(), artist: z.string().trim().max(160).nullable().optional(), bpm: z.number().int().min(20).max(300).nullable().optional(), genre: z.string().trim().max(80).nullable().optional(), notes: z.string().trim().max(5000).nullable().optional(), chordUrl: z.string().url().max(2000).nullable().optional(), audienceRequestable: z.boolean().optional() });

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const parsed = updateInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid song details" }, { status: 400 });
  const id = (await params).id;
  const { chordUrl, ...songData } = parsed.data;
  const db = getDb();
  const result = await db.transaction(async (tx) => {
    const [song] = await tx.update(songs).set({ ...songData, updatedAt: new Date() }).where(eq(songs.id, id)).returning();
    if (!song) return null;
    if (chordUrl !== undefined) {
      const [preferred] = await tx.select({ id: chordSources.id }).from(chordSources).where(and(eq(chordSources.songId, id), eq(chordSources.isPreferred, true))).limit(1);
      if (preferred) await tx.update(chordSources).set({ externalUrl: chordUrl }).where(eq(chordSources.id, preferred.id));
      else if (chordUrl) await tx.insert(chordSources).values({ songId: id, label: "Chord link", externalUrl: chordUrl, isPreferred: true, createdBy: null });
    }
    return song;
  });
  return result ? NextResponse.json({ ...result, chordUrl: chordUrl ?? null }) : NextResponse.json({ error: "Song not found" }, { status: 404 });
}
export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const [deleted] = await getDb().delete(songs).where(eq(songs.id, (await params).id)).returning({ id: songs.id });
    return deleted ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Song not found" }, { status: 404 });
  } catch {
    return NextResponse.json({ error: "This song is used in a session and cannot be removed." }, { status: 409 });
  }
}
