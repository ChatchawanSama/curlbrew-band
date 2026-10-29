import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { getDb } from "@/db";
import { songs } from "@/db/schema";

export async function GET() {
  const rows = await getDb().select().from(songs).orderBy(desc(songs.updatedAt));
  return NextResponse.json({ exportedAt: new Date().toISOString(), songs: rows }, { headers: { "Content-Disposition": 'attachment; filename="curlbrew-library.json"' } });
}
