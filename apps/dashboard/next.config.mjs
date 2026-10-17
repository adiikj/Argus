import process from 'node:process';
import { URL } from 'node:url';

const isDev = process.env.NODE_ENV !== 'production';

// the same defaults lib/realtime.tsx and lib/use-simulator.ts fall back to
const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:4100/ws';
const API_URL = WS_URL.replace(/^ws(s?):\/\//, 'http$1://').replace(/\/ws$/, '');
const GENERATOR_URL = process.env.NEXT_PUBLIC_GENERATOR_URL ?? 'http://localhost:4200';

const origin = (url) => new URL(url).origin;
const GOOGLE = 'https://accounts.google.com'; // Sign in with Google (script, iframe, XHR)

// 'unsafe-inline' scripts: Next.js App Router emits inline bootstrap scripts,
// and the strict alternative (per-request nonces via middleware) forces every
// page to render dynamically. The policy still pins script *sources* to self
// + Google, blocks plugins, framing, base-tag and form-action hijacks, and
// limits where the page can send data (connect-src) to Argus's own backends.
const csp = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-inline' ${GOOGLE}${isDev ? ` 'unsafe-eval'` : ''}`,
  `style-src 'self' 'unsafe-inline' ${GOOGLE}`,
  `img-src 'self' data: blob: https://*.googleusercontent.com`,
  `font-src 'self' data:`,
  `connect-src 'self' ${origin(API_URL)} ${origin(WS_URL)} ${origin(GENERATOR_URL)} ${GOOGLE}${isDev ? ' ws:' : ''}`,
  `frame-src ${GOOGLE}`,
  `frame-ancestors 'none'`,
  `object-src 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  ...(isDev ? [] : ['upgrade-insecure-requests']),
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  ...(isDev
    ? []
    : [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }]),
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // minimal self-contained server bundle for the production Docker image (§16)
  output: 'standalone',
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
