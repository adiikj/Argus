'use client';

import { useMutation } from '@tanstack/react-query';
import type { IncidentQueryResult } from '@argus/contracts';
import { API_URL } from './realtime';
import { authFetch } from './auth';

async function queryIncidentsRequest(question: string): Promise<IncidentQueryResult> {
  const res = await authFetch(`${API_URL}/incidents/query`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ question }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `query failed: ${res.status}`);
  }
  return (await res.json()) as IncidentQueryResult;
}

export function useQueryIncidents() {
  return useMutation({ mutationFn: queryIncidentsRequest });
}
