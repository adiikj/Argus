'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { API_URL } from '@/lib/realtime';
import { getToken, setToken } from '@/lib/auth';
import { useGoogleSignIn, GOOGLE_BUTTON_ELEMENT_ID } from '@/lib/use-google-signin';
import { Button } from '@/components/ui/button';
import { Wordmark } from '../_components/wordmark';

type Mode = 'login' | 'register';

const INPUT_CLASS =
  'w-full rounded-lg border border-border-subtle bg-bg-base px-3 py-2.5 text-sm text-text-primary placeholder:text-text-secondary/60 transition-colors focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/15';

const LABEL_CLASS = 'font-mono text-[10px] uppercase tracking-[0.15em] text-text-secondary';

function MailIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      className="h-4 w-4"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16v12H4z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 7l8 6 8-6" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      className="h-4 w-4"
    >
      <rect x="5" y="11" width="14" height="9" rx="1.5" />
      <path strokeLinecap="round" d="M8 11V8a4 4 0 018 0v3" />
    </svg>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      className="h-4 w-4"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"
      />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      className="h-4 w-4"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 3l18 18M10.6 10.6a3 3 0 004.24 4.24M6.7 6.7C4.4 8.1 2.7 10.3 2 12c0 0 3.5 7 10 7 2 0 3.7-.6 5.1-1.5M9.9 4.2A9.6 9.6 0 0112 4c6.5 0 10 7 10 7-.4.8-1 1.9-1.9 3"
      />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const finishLogin = (token: string): void => {
    setToken(token);
    router.replace('/overview');
  };

  // already have a session (e.g. arrived here from the landing page's CTA
  // while still logged in) — skip the form entirely.
  useEffect(() => {
    if (getToken()) router.replace('/overview');
  }, [router]);

  const { enabled: googleEnabled } = useGoogleSignIn(
    async (credential) => {
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
    },
    mode === 'register' ? 'signup_with' : 'signin_with',
  );

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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-bg-base px-4">
      {/* faint grid, matching the landing page hero */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(var(--color-text-secondary) 1px, transparent 1px), linear-gradient(90deg, var(--color-text-secondary) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />
      <div
        aria-hidden
        className="animate-glow pointer-events-none absolute left-1/2 top-1/2 -z-10 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/15 blur-3xl"
      />

      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Wordmark />
        </div>

        <div className="rounded-2xl border border-border-subtle bg-bg-panel p-7 shadow-2xl shadow-black/40">
          <div className="mb-6 flex items-center gap-1 rounded-lg border border-border-subtle bg-bg-base p-1">
            {(['login', 'register'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  setError(null);
                }}
                className={`flex-1 rounded-md py-1.5 font-mono text-xs uppercase tracking-wider transition-colors ${
                  mode === m
                    ? 'bg-accent text-bg-base font-semibold'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {m === 'login' ? 'Sign in' : 'Sign up'}
              </button>
            ))}
          </div>

          <p className="mb-5 text-sm text-text-secondary">
            {mode === 'login'
              ? 'Sign in to reach the live console.'
              : 'Create an account to reach the live console.'}
          </p>

          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className={LABEL_CLASS}>
                Email
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary">
                  <MailIcon />
                </span>
                <input
                  id="email"
                  type="email"
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={`${INPUT_CLASS} pl-9`}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className={LABEL_CLASS}>
                Password
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary">
                  <LockIcon />
                </span>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'login' ? '••••••••' : 'min. 8 characters'}
                  className={`${INPUT_CLASS} pl-9 pr-9`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary transition-colors hover:text-text-primary"
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>
            </div>

            {error && (
              <p className="rounded-lg border border-severity-critical/30 bg-severity-critical/10 px-3 py-2 text-xs text-severity-critical">
                {error}
              </p>
            )}

            <Button
              type="submit"
              size="lg"
              disabled={pending || !email || !password}
              className="w-full"
            >
              {pending ? 'Checking…' : mode === 'login' ? 'Sign in' : 'Create account'}
            </Button>
          </form>

          {googleEnabled && (
            <>
              <div className="my-5 flex items-center gap-3 font-mono text-[10px] uppercase tracking-wider text-text-secondary">
                <span className="h-px flex-1 bg-border-subtle" />
                or continue with
                <span className="h-px flex-1 bg-border-subtle" />
              </div>
              <div id={GOOGLE_BUTTON_ELEMENT_ID} className="flex justify-center" />
            </>
          )}
        </div>

        <p className="mt-6 text-center font-mono text-xs text-text-secondary">
          {mode === 'login' ? (
            <>
              Don&apos;t have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setError(null);
                }}
                className="text-accent hover:underline"
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError(null);
                }}
                className="text-accent hover:underline"
              >
                Sign in
              </button>
            </>
          )}
        </p>
      </div>
    </main>
  );
}
