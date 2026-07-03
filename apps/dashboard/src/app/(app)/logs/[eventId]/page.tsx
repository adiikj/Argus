import { TraceClient } from './trace-client';

export default async function TracePage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  return <TraceClient eventId={eventId} />;
}
