import { randomUUID } from 'node:crypto';
import { RawLog } from '@argus/contracts';

// Builders for each raw log shape the generator emits. The wire formats here
// are the contract the api-side parsers reverse (apps/api/src/parser) — auth is
// syslog-ish text, nginx is combined access-log text, api-gateway is JSON. Two
// text formats + one structured on purpose, so parsing shows more than one style.

export function randInt(maxExclusive: number): number {
  return Math.floor(Math.random() * maxExclusive);
}

export function pick<T>(items: readonly T[]): T {
  // callers always pass non-empty literals; the assertion keeps the type clean
  return items[randInt(items.length)]!;
}

// TEST-NET-3 (203.0.113.0/24) — reserved for documentation, safe to fake.
export function benignIp(): string {
  return `203.0.113.${1 + randInt(254)}`;
}

function makeRaw(source: RawLog['source'], message: string): RawLog {
  return RawLog.parse({
    eventId: randomUUID(),
    timestamp: new Date().toISOString(),
    source,
    message,
  });
}

export function authLog(opts: {
  user: string;
  ip: string;
  outcome: 'success' | 'failure';
}): RawLog {
  const port = 1024 + randInt(60000);
  const verb = opts.outcome === 'success' ? 'Accepted' : 'Failed';
  return makeRaw('auth', `${verb} password for ${opts.user} from ${opts.ip} port ${port} ssh2`);
}

const NGINX_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

function nginxTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const day = pad(date.getUTCDate());
  const mon = NGINX_MONTHS[date.getUTCMonth()];
  const y = date.getUTCFullYear();
  const t = `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
  return `${day}/${mon}/${y}:${t} +0000`;
}

export function nginxLog(opts: {
  ip: string;
  method?: string;
  path: string;
  status: number;
  userAgent?: string;
}): RawLog {
  const method = opts.method ?? 'GET';
  const ua = opts.userAgent ?? 'Mozilla/5.0';
  const bytes = 200 + randInt(4000);
  const line = `${opts.ip} - - [${nginxTime(new Date())}] "${method} ${opts.path} HTTP/1.1" ${opts.status} ${bytes} "-" "${ua}"`;
  return makeRaw('nginx', line);
}

export function apiGatewayLog(opts: {
  ip: string;
  method?: string;
  path: string;
  status: number;
  userAgent?: string;
  user?: string;
}): RawLog {
  return makeRaw(
    'api-gateway',
    JSON.stringify({
      ip: opts.ip,
      method: opts.method ?? 'GET',
      path: opts.path,
      status: opts.status,
      userAgent: opts.userAgent ?? 'Mozilla/5.0',
      ...(opts.user ? { user: opts.user } : {}),
    }),
  );
}
