'use client';

import { useQuery } from '@tanstack/react-query';
import type { Alert, Incident, NormalizedEvent } from '@argus/contracts';
import { API_URL } from './realtime';

export interface EventTrace {
  eventId: string;
  event: NormalizedEvent | undefined;
  alerts: Alert[];
  incidents: Incident[];
}

async function fetchEventTrace(eventId: string): Promise<EventTrace> {
  const res = await fetch(`${API_URL}/events/${eventId}/trace`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`trace request failed: ${res.status}`);
  return (await res.json()) as EventTrace;
}

export function useEventTrace(eventId: string) {
  return useQuery({
    queryKey: ['event-trace', eventId],
    queryFn: () => fetchEventTrace(eventId),
  });
}
