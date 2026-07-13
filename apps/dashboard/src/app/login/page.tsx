'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { API_URL } from '@/lib/realtime';
import { setToken } from '@/lib/auth';
import { useGoogleSignIn, GOOGLE_BUTTON_ELEMENT_ID } from '@/lib/use-google-signin';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Wordmark } from '../_components/wordmark';

type Mode = 'login' | 'register';

const INPUT_CLASS =
  'rounded-md border border-border-subtle bg-bg-panel px-3 py-1.5 text-sm text-text-primary placeholder:text-text-secondary focus:border-accent/50 focus:outline-none';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const finishLogin = (token: string): void => {
    setToken(token);
    router.replace('/overview');
  };

  const { enabled: googleEnabled } = useGoogleSignIn(async (credential) => {
    setError(null);
    try {
      const res = await fetch(`${API_URL}/auth/google`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ credential }),
      });
      if (!res.ok) {
        setError('Google sign-in failed.');
        return;
      }
      const { token } = (await res.json()) as { token: string };
      finishLogin(token);
    } catch {
      setError('Google sign-in failed.');
    }
  });

  const onSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/auth/${mode}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(
          body.error ?? (mode === 'login' ? 'Invalid email or password.' : 'Registration failed.'),
        );
        return;
      }
      const { token } = (await res.json()) as { token: string };
      finishLogin(token);
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg-base px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <Wordmark />
          <CardTitle>{mode === 'login' ? 'Sign in' : 'Create an account'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-3">
            <input
              type="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email"
              className={INPUT_CLASS}
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'login' ? 'password' : 'password (min 8 characters)'}
              className={INPUT_CLASS}
            />
            {error && <p className="text-xs text-severity-critical">{error}</p>}
            <Button type="submit" disabled={pending || !email || !password}>
              {pending ? 'Checking…' : mode === 'login' ? 'Sign in' : 'Create account'}
            </Button>
          </form>

          {googleEnabled && (
            <>
              <div className="my-4 flex items-center gap-3 text-xs text-text-secondary">
                <span className="h-px flex-1 bg-border-subtle" />
                or
                <span className="h-px flex-1 bg-border-subtle" />
              </div>
              <div id={GOOGLE_BUTTON_ELEMENT_ID} className="flex justify-center" />
            </>
          )}

          <button
            type="button"
            onClick={() => {
              setMode((m) => (m === 'login' ? 'register' : 'login'));
              setError(null);
            }}
            className="mt-4 w-full text-center text-xs text-text-secondary hover:text-text-primary"
          >
            {mode === 'login'
              ? "Don't have an account? Sign up"
              : 'Already have an account? Sign in'}
          </button>
        </CardContent>
      </Card>
    </main>
  );
}
