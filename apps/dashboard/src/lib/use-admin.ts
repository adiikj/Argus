'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AdminUser, AuditEntry, Role } from '@argus/contracts';
import { API_URL } from './realtime';
import { authFetch } from './auth';

async function getJson<T>(path: string): Promise<T> {
  const res = await authFetch(`${API_URL}${path}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${path} request failed: ${res.status}`);
  return (await res.json()) as T;
}

export function useAdminUsers(enabled: boolean) {
  return useQuery({
    queryKey: ['admin', 'users'],
    queryFn: async () => (await getJson<{ users: AdminUser[] }>('/admin/users')).users,
    enabled,
    retry: false,
  });
}

export function useAuditLog(enabled: boolean) {
  return useQuery({
    queryKey: ['admin', 'audit'],
    queryFn: async () =>
      (await getJson<{ entries: AuditEntry[] }>('/admin/audit?limit=200')).entries,
    enabled,
    refetchInterval: 15_000,
    retry: false,
  });
}

export function useSetRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: Role }) => {
      const res = await authFetch(`${API_URL}/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `role change failed: ${res.status}`);
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['admin'] }),
  });
}
