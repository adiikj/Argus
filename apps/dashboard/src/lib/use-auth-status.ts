'use client';

import { useQuery } from '@tanstack/react-query';
import { API_URL } from './realtime';

export interface AuthStatus {
  required: boolean;
}

// fails open — an unreachable api shouldn't lock a demo out of its own login page,
// and every other query will surface the same "unreachable" state anyway.
async function fetchAuthStatus(): Promise<AuthStatus> {
  try {
    const res = await fetch(`${API_URL}/auth/status`, { cache: 'no-store' });
    if (!res.ok) return { required: false };
    return (await res.json()) as AuthStatus;
  } catch {
    return { required: false };
  }
}

export function useAuthStatus() {
  return useQuery({
    queryKey: ['auth-status'],
    queryFn: fetchAuthStatus,
    retry: false,
    staleTime: 60_000,
  });
}
