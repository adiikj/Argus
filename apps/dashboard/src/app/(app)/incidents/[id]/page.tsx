import { IncidentDetailClient } from './detail-client';

export default async function IncidentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <IncidentDetailClient id={id} />;
}
