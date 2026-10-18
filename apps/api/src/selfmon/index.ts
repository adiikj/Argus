import { randomUUID } from 'node:crypto';
import type { RawLog } from '@argus/contracts';

// Argus watching itself. The api's own authentication outcomes (console
// logins, rejected session tokens, role denials, bad ingest tokens) become
// log lines on raw.logs with source 'argus', so the platform's own front door
// is covered by the same parser -> rules -> incidents path as everything
// else, with no special case downstream.

export interface SecurityEvent {
  ip: string;
  method: string;
  path: string; // query string stripped: /ws?token=… must never be logged
  status: number;
  outcome: 'success' | 'failure';
  reason: string;
  user?: string; // already masked, see maskEmail
  userAgent?: string;
}

// account emails are personal data and the Log Explorer is readable by the
// public demo account, so lines carry a masked form: first character of the
// local part, the length, the domain. Stable per address, so failures and a
// later success for the same account still line up for the rules.
export function maskEmail(email: string | undefined): string | undefined {
  const trimmed = email?.trim().toLowerCase();
  if (!trimmed) return undefined;
  const at = trimmed.lastIndexOf('@');
  if (at < 1) return `${trimmed[0]}*${trimmed.length}`;
  const local = trimmed.slice(0, at);
  return `${local[0]}*${local.length}@${trimmed.slice(at + 1)}`;
}

// an IPv4 client on a dual-stack socket shows up as ::ffff:1.2.3.4; log the
// plain IPv4 so it keys the same as that client's other events
export function plainIp(ip: string): string {
  return ip.startsWith('::ffff:') && ip.includes('.') ? ip.slice(7) : ip;
}

export function stripQuery(url: string): string {
  return url.split('?')[0] ?? url;
}

export function securityEventLog(event: SecurityEvent, now: Date = new Date()): RawLog {
  return {
    eventId: randomUUID(),
    timestamp: now.toISOString(),
    source: 'argus',
    message: JSON.stringify({
      ip: plainIp(event.ip),
      method: event.method,
      path: event.path,
      status: event.status,
      outcome: event.outcome,
      reason: event.reason,
      ...(event.user ? { user: event.user } : {}),
      ...(event.userAgent ? { userAgent: event.userAgent.slice(0, 300) } : {}),
    }),
  };
}
