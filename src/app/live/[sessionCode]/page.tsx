import AudienceLive from "@/components/audience-live";

export default async function LiveAudiencePage({ params }: { params: Promise<{ sessionCode: string }> }) {
  const { sessionCode } = await params;
  return <AudienceLive sessionCode={sessionCode} />;
}
