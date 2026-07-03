'use client';

import { useQuery } from '@tanstack/react-query';
import type { Alert, Incident, IncidentSummary } from '@argus/contracts';
import { API_URL } from './realtime';
import { authFetch } from './auth';

export interface IncidentDetail {
  incident: Incident;
  alerts: Alert[];
  summary: IncidentSummary | undefined;
}

async function fetchIncidentDetail(id: string): Promise<IncidentDetail> {
  const res = await authFetch(`${API_URL}/incidents/${id}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`incident request failed: ${res.status}`);
  return (await res.json()) as IncidentDetail;
}

export function useIncidentDetail(id: string) {
  return useQuery({
    queryKey: ['incident', id],
    queryFn: () => fetchIncidentDetail(id),
    retry: false,
  });
}
