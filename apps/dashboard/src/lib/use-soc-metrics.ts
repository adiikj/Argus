'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { SocMetrics } from '@argus/contracts';
import { API_URL } from './realtime';
import { authFetch } from './auth';

async function fetchSocMetrics(days: number): Promise<SocMetrics> {
  const res = await authFetch(`${API_URL}/soc-metrics?days=${days}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`soc metrics request failed: ${res.status}`);
  return (await res.json()) as SocMetrics;
}

export function useSocMetrics(days: number) {
  return useQuery({
    queryKey: ['soc-metrics', days],
    queryFn: () => fetchSocMetrics(days),
    refetchInterval: 30_000,
    placeholderData: keepPreviousData, // switching range keeps the old numbers up until the new ones land
    retry: false,
  });
}

// 75 -> "1m 15s", 540 -> "9m", 7260 -> "2h 1m"
export function formatDuration(seconds: number | null): string {
  if (seconds === null) return '-';
  const s = Math.round(seconds);
  if (s < 1) return '<1s';
  if (s < 60) return `${s}s`;
  if (s < 3600) return pair(Math.floor(s / 60), 'm', s % 60, 's');
  if (s < 86_400) return pair(Math.floor(s / 3600), 'h', Math.floor((s % 3600) / 60), 'm');
  return pair(Math.floor(s / 86_400), 'd', Math.floor((s % 86_400) / 3600), 'h');
}

function pair(major: number, majorUnit: string, minor: number, minorUnit: string): string {
  return minor === 0 ? `${major}${majorUnit}` : `${major}${majorUnit} ${minor}${minorUnit}`;
}

export function formatRate(rate: number | null): string {
  return rate === null ? '-' : `${Math.round(rate * 100)}%`;
}
