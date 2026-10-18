'use client';

import { useQuery } from '@tanstack/react-query';
import type { PublicUser } from '@argus/contracts';
import { API_URL } from './realtime';
import { authFetch } from './auth';

async function fetchUsers(): Promise<PublicUser[]> {
  const res = await authFetch(`${API_URL}/users`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`users request failed: ${res.status}`);
  const body = (await res.json()) as { users: PublicUser[] };
  return body.users;
}

// enabled=false for viewers: the api hides the account list from them
export function useUsers(enabled = true) {
  return useQuery({ queryKey: ['users'], queryFn: fetchUsers, staleTime: 60_000, enabled });
}
