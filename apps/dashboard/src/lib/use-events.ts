'use client';

import { useQuery } from '@tanstack/react-query';
import type { NormalizedEvent } from '@argus/contracts';
import { API_URL } from './realtime';
import { authFetch } from './auth';

export interface EventSearchParams {
  q?: string;
  source?: string;
  limit?: number;
}

async function fetchEvents(params: EventSearchParams): Promise<NormalizedEvent[]> {
  const search = new URLSearchParams();
  if (params.q) search.set('q', params.q);
  if (params.source) search.set('source', params.source);
  if (params.limit) search.set('limit', String(params.limit));

  const res = await authFetch(`${API_URL}/events?${search.toString()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`events request failed: ${res.status}`);
  const body = (await res.json()) as { events: NormalizedEvent[] };
  return body.events;
}

export function useEvents(params: EventSearchParams) {
  return useQuery({
    queryKey: ['events', params],
    queryFn: () => fetchEvents(params),
  });
}
