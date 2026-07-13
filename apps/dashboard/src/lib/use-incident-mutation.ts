'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Incident, IncidentPatch } from '@argus/contracts';
import { API_URL } from './realtime';
import { authFetch } from './auth';
import type { IncidentDetail } from './use-incident-detail';

async function patchIncidentRequest(id: string, patch: IncidentPatch): Promise<Incident> {
  const res = await authFetch(`${API_URL}/incidents/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `patch failed: ${res.status}`);
  }
  return (await res.json()) as Incident;
}

export function usePatchIncident(id: string) {
  const queryClient = useQueryClient();
  const queryKey = ['incident', id];

  return useMutation({
    mutationFn: (patch: IncidentPatch) => patchIncidentRequest(id, patch),
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<IncidentDetail>(queryKey);
      queryClient.setQueryData<IncidentDetail>(queryKey, (old) =>
        old ? { ...old, incident: { ...old.incident, ...patch } } : old,
      );
      return { previous };
    },
    onError: (_err, _patch, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });
}
