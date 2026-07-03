'use client';

import { useQuery } from '@tanstack/react-query';
import { API_URL } from './realtime';
import { authFetch } from './auth';

export interface Metrics {
  uptimeSeconds: number;
  rawLogsConsumed: number;
  eventsNormalized: number;
  parseFailures: number;
  eventsIndexed: number;
  alertsRaised: number;
  incidentsOpened: number;
  incidentsUpdated: number;
  summariesGenerated: number;
}

async function fetchMetrics(): Promise<Metrics> {
  const res = await authFetch(`${API_URL}/metrics`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`metrics request failed: ${res.status}`);
  return (await res.json()) as Metrics;
}

export function useMetrics() {
  return useQuery({
    queryKey: ['metrics'],
    queryFn: fetchMetrics,
    refetchInterval: 3000,
    retry: false,
  });
}
