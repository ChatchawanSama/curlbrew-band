import { and, asc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { liveSessions, sessionQueueItems, songs } from "@/db/schema";
import { isAdminAuthenticated } from "@/lib/admin-auth";

const queueAction = z.object({ action: z.enum(["start", "complete", "skip", "move", "edit"]), position: z.number().int().positive().optional(), orderedIds: z.array(z.string().uuid()).min(1).optional(), title: z.string().trim().min(1).max(160).optional(), artist: z.string().trim().max(160).nullable().optional(), preferredKey: z.string().trim().max(12).nullable().optional(), notes: z.string().trim().max(5000).nullable().optional(), chordUrl: z.string().url().max(2000).nullable().optional() });

export async function PATCH(request: Request, { params }: { params: Promise<{ roomCode: string; itemId: string }> }) {
  const { roomCode, itemId } = await params;
  const db = getDb();
  const [session] = await db.select({ id: liveSessions.id, managementSecretHash: liveSessions.managementSecretHash }).from(liveSessions).where(eq(liveSessions.code, roomCode)).limit(1);
  const parsed = queueAction.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid queue action" }, { status: 400 });
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  try {
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`select id from live_sessions where id = ${session.id} for update`);
      const [item] = await tx.select().from(sessionQueueItems).where(and(eq(sessionQueueItems.id, itemId), eq(sessionQueueItems.sessionId, session.id))).limit(1);
      if (!item) throw new Error("Queue item not found");

      if (parsed.data.action === "edit") {
        if (item.status !== "queued" && item.status !== "playing") throw new Error("Only active songs can be edited");
        const { title, artist, preferredKey, notes, chordUrl } = parsed.data;
        if (title !== undefined || artist !== undefined || preferredKey !== undefined || notes !== undefined) {
          await tx.update(songs).set({
            ...(title !== undefined ? { title } : {}),
            ...(artist !== undefined ? { artist } : {}),
            ...(preferredKey !== undefined ? { preferredKey } : {}),
            ...(notes !== undefined ? { notes } : {}),
            updatedAt: new Date(),
          }).where(eq(songs.id, item.songId));
        }
        const [updated] = await tx.update(sessionQueueItems).set({
          ...(artist !== undefined ? { entryArtist: artist } : {}),
          ...(preferredKey !== undefined ? { entryKey: preferredKey } : {}),
          ...(notes !== undefined ? { entryNote: notes } : {}),
          ...(chordUrl !== undefined ? { entryChordUrl: chordUrl } : {}),
          updatedAt: new Date(),
        }).where(eq(sessionQueueItems.id, item.id)).returning();
        return [updated];
      }

      if (!(await isAdminAuthenticated())) throw new Error("Admin authentication required for queue control");

      if (parsed.data.action === "start") {
        if (item.status !== "queued") throw new Error("Only a queued song can start");
        const [playing] = await tx.select({ id: sessionQueueItems.id }).from(sessionQueueItems).where(and(eq(sessionQueueItems.sessionId, session.id), eq(sessionQueueItems.status, "playing"))).limit(1);
        if (playing) throw new Error("Another song is already playing");
        return tx.update(sessionQueueItems).set({ status: "playing", updatedAt: new Date() }).where(eq(sessionQueueItems.id, item.id)).returning();
      }

      if (parsed.data.action === "complete" || parsed.data.action === "skip") {
        if (item.status !== "playing") throw new Error("Only the playing song can be completed or skipped");
        const nextStatus = parsed.data.action === "complete" ? "completed" : "skipped";
        const updated = await tx.update(sessionQueueItems).set({ status: nextStatus, updatedAt: new Date() }).where(eq(sessionQueueItems.id, item.id)).returning();
        const [next] = await tx.select({ id: sessionQueueItems.id }).from(sessionQueueItems).where(and(eq(sessionQueueItems.sessionId, session.id), eq(sessionQueueItems.status, "queued"))).orderBy(asc(sessionQueueItems.queueOrder), asc(sessionQueueItems.id)).limit(1);
        if (next) await tx.update(sessionQueueItems).set({ status: "playing", updatedAt: new Date() }).where(eq(sessionQueueItems.id, next.id));
        return updated;
      }

      if (item.status !== "queued") throw new Error("Only queued songs can be reordered");
      if (parsed.data.orderedIds) {
        const items = await tx.select().from(sessionQueueItems).where(and(eq(sessionQueueItems.sessionId, session.id), eq(sessionQueueItems.status, "queued"))).orderBy(asc(sessionQueueItems.queueOrder), asc(sessionQueueItems.id));
        const currentIds = items.map((queueItem) => queueItem.id);
        const requestedIds = parsed.data.orderedIds;
        if (requestedIds.length !== currentIds.length || new Set(requestedIds).size !== currentIds.length || requestedIds.some((id) => !currentIds.includes(id))) throw new Error("Invalid queued order");
        const requestedItem = items.find((queueItem) => queueItem.id === item.id);
        if (!requestedItem) throw new Error("Only queued songs can be reordered");
        const max = await tx.execute<{ max: string | number | null }>(sql`select max(queue_order) as max from session_queue_items where session_id = ${session.id}`);
        const base = Math.max(Date.now(), Number(max.rows[0]?.max ?? 0) + 1);
        for (const [index, id] of requestedIds.entries()) await tx.update(sessionQueueItems).set({ queueOrder: base + index, position: index + 1, updatedAt: new Date() }).where(and(eq(sessionQueueItems.id, id), eq(sessionQueueItems.sessionId, session.id), eq(sessionQueueItems.status, "queued")));
        return tx.select().from(sessionQueueItems).where(eq(sessionQueueItems.id, item.id)).limit(1);
      }
      const position = parsed.data.position;
      if (!position) throw new Error("Position is required");
      const items = await tx.select().from(sessionQueueItems).where(and(eq(sessionQueueItems.sessionId, session.id), eq(sessionQueueItems.status, "queued"))).orderBy(asc(sessionQueueItems.queueOrder), asc(sessionQueueItems.id));
      const currentIndex = items.findIndex((candidate) => candidate.id === item.id);
      if (currentIndex < 0 || position > items.length) throw new Error("Invalid queued position");
      const [moving] = items.splice(currentIndex, 1);
      items.splice(position - 1, 0, moving);
      const max = await tx.execute<{ max: string | number | null }>(sql`select max(queue_order) as max from session_queue_items where session_id = ${session.id}`);
      const base = Math.max(Date.now(), Number(max.rows[0]?.max ?? 0) + 1);
      for (const [index, queueItem] of items.entries()) await tx.update(sessionQueueItems).set({ queueOrder: base + index, position: index + 1, updatedAt: new Date() }).where(eq(sessionQueueItems.id, queueItem.id));
      return tx.select().from(sessionQueueItems).where(eq(sessionQueueItems.id, item.id)).limit(1);
    });
    return NextResponse.json(result[0]);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Queue update failed" }, { status: 409 });
  }
}
