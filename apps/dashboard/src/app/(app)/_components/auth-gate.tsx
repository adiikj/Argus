'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStatus } from '@/lib/use-auth-status';
import { getToken } from '@/lib/auth';

// Renders immediately rather than blocking on the auth-status round-trip —
// every real data call is still gated by its own bearer token/WS query param
// regardless, so the shell alone has nothing to hide. Redirects to /login
// only once we actually know a token is required and missing.
export function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { data } = useAuthStatus();

  useEffect(() => {
    if (data?.required && !getToken()) router.replace('/login');
  }, [data, router]);

  return <>{children}</>;
}
