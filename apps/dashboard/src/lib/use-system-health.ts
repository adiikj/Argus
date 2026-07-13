'use client';

import { useQuery } from '@tanstack/react-query';
import { API_URL } from './realtime';
import { authFetch } from './auth';

export interface ConsumerLag {
  groupId: string;
  topic: string;
  lag: number;
}

export interface SystemHealth {
  kafka: { ok: boolean; consumerLag: ConsumerLag[] };
  search: { ok: boolean; backend: 'elasticsearch' | 'postgres'; status: string | null };
  postgres: { ok: boolean; latencyMs: number | null };
}

async function fetchSystemHealth(): Promise<SystemHealth> {
  const res = await authFetch(`${API_URL}/system/health`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`system health request failed: ${res.status}`);
  return (await res.json()) as SystemHealth;
}

export function useSystemHealth() {
  return useQuery({
    queryKey: ['system-health'],
    queryFn: fetchSystemHealth,
    refetchInterval: 5000,
    retry: false,
  });
}
