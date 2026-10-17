'use client';

const TOKEN_KEY = 'argus_token';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  window.sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  window.sessionStorage.removeItem(TOKEN_KEY);
}

// drop-in fetch replacement: attaches the bearer token if we have one, and
// bounces to /login on a 401 (expired/invalid token or auth newly required).
export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('authorization', `Bearer ${token}`);

  const res = await fetch(input, { ...init, headers });
  if (res.status === 401 && typeof window !== 'undefined') {
    clearToken();
    window.location.href = '/login';
  }
  return res;
}

export type SessionRole = 'admin' | 'analyst' | 'viewer';
const ROLES: readonly string[] = ['admin', 'analyst', 'viewer'];

// decoded for UI hints only (hiding controls a viewer can't use) — the api
// verifies the signature and enforces the role on every request regardless.
export function getRole(): SessionRole | null {
  const payload = getToken()?.split('.')[1];
  if (!payload) return null;
  try {
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const role = (JSON.parse(json) as { role?: unknown }).role;
    return typeof role === 'string' && ROLES.includes(role) ? (role as SessionRole) : null;
  } catch {
    return null;
  }
}
