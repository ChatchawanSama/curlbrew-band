import { redirect } from "next/navigation";

export default async function AudienceSessionPage({ params }: { params: Promise<{ roomCode: string }> }) { const { roomCode } = await params; redirect(("/session/" + roomCode) as never); }
