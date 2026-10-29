import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { chordSources } from "@/db/schema";
import { z } from "zod";

const sourceInput = z.object({ label: z.string().trim().min(1).max(160), externalUrl: z.string().url().optional(), isPreferred: z.boolean().default(false) });
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { const parsed = sourceInput.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "Add a label and a valid external URL" }, { status: 400 }); const [source] = await getDb().insert(chordSources).values({ songId: (await params).id, createdBy: null, ...parsed.data }).returning(); return NextResponse.json(source, { status: 201 }); }
