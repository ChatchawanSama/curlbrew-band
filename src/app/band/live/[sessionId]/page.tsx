import LiveControl from "@/components/live-control";

export default async function BandLiveControlPage({ params }: { params: Promise<{ sessionId: string }> }) { const { sessionId } = await params; return <LiveControl sessionCode={sessionId} />; }
