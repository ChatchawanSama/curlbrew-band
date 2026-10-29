import { and, asc, eq, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { liveSessions, requestStatusHistory, songRequests } from "@/db/schema";
import { controlInput } from "@/lib/live";
import { requireMember } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ sessionCode: string }> }) {
  const member = await requireMember().catch(() => null);
  if (!member) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const parsed = controlInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid live control action" }, { status: 400 });
  const { sessionCode } = await params;
  const db = getDb();
  try {
    const result = await db.transaction(async (tx) => {
      const [session] = await tx.select().from(liveSessions).where(eq(liveSessions.code, sessionCode)).limit(1);
      if (!session || session.status === "completed") throw new Error("Session is not active");
      if (parsed.data.action === "toggle-requests") {
        await tx.update(liveSessions).set({ requestsOpen: !session.requestsOpen, updatedAt: new Date() }).where(eq(liveSessions.id, session.id));
        return { requestsOpen: !session.requestsOpen };
      }
      if (parsed.data.action === "end-session") {
        await tx.update(liveSessions).set({ status: "completed", requestsOpen: false, endedAt: new Date(), updatedAt: new Date() }).where(eq(liveSessions.id, session.id));
        return { ended: true };
      }
      if (parsed.data.action === "approve") {
        const max = await tx.execute<{ max: number | null }>(sql`select max(queue_position)::int as max from song_requests where session_id = ${session.id} and status = 'queued'`);
        const queuePosition = (max.rows[0]?.max ?? 0) + 1;
        const updated = await tx.update(songRequests).set({ status: "queued", queuePosition, updatedAt: new Date() }).where(and(eq(songRequests.id, parsed.data.requestId), eq(songRequests.sessionId, session.id), eq(songRequests.status, "pending"))).returning();
        if (!updated.length) throw new Error("Request is no longer pending");
        return { request: updated[0] };
      }
      if (parsed.data.action === "reject" || parsed.data.action === "remove") {
        const nextStatus = parsed.data.action === "reject" ? "rejected" : "skipped" as const;
        const updated = await tx.update(songRequests).set({ status: nextStatus, queuePosition: null, updatedAt: new Date() }).where(and(eq(songRequests.id, parsed.data.requestId), eq(songRequests.sessionId, session.id), sql`${songRequests.status} in ('pending', 'queued')`)).returning();
        if (!updated.length) throw new Error("Request cannot be changed");
        return { request: updated[0] };
      }
      if (parsed.data.action === "play") {
        if (session.nowPlayingRequestId) throw new Error("Finish the current song first");
        const updated = await tx.update(songRequests).set({ status: "playing", updatedAt: new Date() }).where(and(eq(songRequests.id, parsed.data.requestId), eq(songRequests.sessionId, session.id), eq(songRequests.status, "queued"))).returning();
        if (!updated.length) throw new Error("Song is not queued");
        await tx.update(liveSessions).set({ nowPlayingRequestId: updated[0].id, updatedAt: new Date() }).where(eq(liveSessions.id, session.id));
        return { request: updated[0] };
      }
      const current = await tx.update(songRequests).set({ status: parsed.data.outcome, queuePosition: null, updatedAt: new Date() }).where(and(eq(songRequests.id, parsed.data.requestId), eq(songRequests.sessionId, session.id), eq(songRequests.status, "playing"))).returning();
      if (!current.length) throw new Error("Song is not playing");
      const [next] = await tx.select().from(songRequests).where(and(eq(songRequests.sessionId, session.id), eq(songRequests.status, "queued"))).orderBy(asc(songRequests.queuePosition)).limit(1);
      if (next) { await tx.update(songRequests).set({ status: "playing", updatedAt: new Date() }).where(eq(songRequests.id, next.id)); }
      await tx.update(liveSessions).set({ nowPlayingRequestId: next?.id ?? null, updatedAt: new Date() }).where(eq(liveSessions.id, session.id));
      return { request: current[0], next: next ?? null };
    });
    return NextResponse.json(result);
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Live control failed" }, { status: 409 }); }
}
