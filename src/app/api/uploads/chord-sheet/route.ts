import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";
import { requireMember } from "@/lib/server-auth";
import { env } from "@/lib/env";
import { getStorageClient } from "@/lib/storage";
import { z } from "zod";

const input = z.object({ songId: z.string().uuid(), sourceId: z.string().uuid(), filename: z.string().trim().min(1).max(180), contentType: z.enum(["image/jpeg", "image/png", "image/webp"]), byteSize: z.number().int().positive().max(10 * 1024 * 1024), pageNumber: z.number().int().positive() });

export async function POST(request: Request) {
  const member = await requireMember().catch(() => null); if (!member) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const parsed = input.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "Only JPG, PNG, and WebP files up to 10 MB are supported." }, { status: 400 });
  try {
    const safeName = parsed.data.filename.replace(/[^a-zA-Z0-9._-]/g, "-");
    const objectKey = `chords/${parsed.data.songId}/${crypto.randomUUID()}-${safeName}`;
    const command = new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: objectKey, ContentType: parsed.data.contentType, ContentLength: parsed.data.byteSize });
    const uploadUrl = await getSignedUrl(getStorageClient(), command, { expiresIn: 300 });
    return NextResponse.json({ uploadUrl, objectKey, pageNumber: parsed.data.pageNumber, expiresIn: 300 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Storage is unavailable" }, { status: 503 }); }
}
