import SessionRoom from "@/components/session-room";

export default async function SessionRoomPage({ params }: { params: Promise<{ roomCode: string }> }) { const { roomCode } = await params; return <SessionRoom roomCode={roomCode} />; }
