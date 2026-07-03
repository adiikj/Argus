'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { API_URL } from '@/lib/realtime';
import { setToken } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Wordmark } from '../_components/wordmark';

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(false);

  const onSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    setPending(true);
    setError(false);
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        setError(true);
        return;
      }
      const { token } = (await res.json()) as { token: string };
      setToken(token);
      router.replace('/overview');
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg-base px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <Wordmark />
          <CardTitle>Sign in</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-3">
            <input
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="site password"
              className="rounded-md border border-border-subtle bg-bg-panel px-3 py-1.5 text-sm text-text-primary placeholder:text-text-secondary focus:border-accent/50 focus:outline-none"
            />
            {error && <p className="text-xs text-severity-critical">Incorrect password.</p>}
            <Button type="submit" disabled={pending || !password}>
              {pending ? 'Checking…' : 'Enter'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
