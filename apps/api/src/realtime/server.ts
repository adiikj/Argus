import Fastify from 'fastify';
import websocketPlugin, { type WebSocket } from '@fastify/websocket';
import {
  IncidentPatch,
  type Alert,
  type GeoPoint,
  type Incident,
  type IncidentQueryResult,
  type IncidentSummary,
  type NormalizedEvent,
  type PublicUser,
  type RecentActivity,
  type AdminUser,
  type AuditEntry,
  type Role,
  RolePatch,
  type SocMetrics,
  type RawLog,
  Source,
} from '@argus/contracts';
import type { AppConfig } from '@argus/config';
import type { Bus, IncidentEvent } from '../bus/index.js';
import { clampDays, type IncidentDetail, type PatchIncidentResult } from '../incident/index.js';
import type { EventSearchParams } from '../storage/index.js';
import type { SystemHealth } from '../system/index.js';
import { canAccess, type AuthService, type SetRoleResult } from '../auth/index.js';
import { RateLimiter } from './rate-limit.js';
import { redactActors, type Actor } from '../audit/index.js';
import { parseIngestBody } from '../ingest/index.js';

declare module 'fastify' {
  interface FastifyRequest {
    // the verified caller, set by the auth hook; null while the gate is open
    actor: Actor | null;
  }
}

// /ingest is not a user route: it checks its own shipper tokens (see below)
const UNGATED_PATHS = [
  '/healthz',
  '/auth/login',
  '/auth/register',
  '/auth/google',
  '/auth/status',
  '/ingest',
];

// 40 immediate requests, refilling at 5/sec (300/min sustained) — comfortably
// above normal dashboard polling (/metrics every 3s, /system/health every 5s
// per open tab), but still a real ceiling against a hammering script.
const REQUEST_LIMITER = new RateLimiter(40, 5);

// tighter brute-force ceiling on the auth endpoints specifically: 5 immediate
// attempts, refilling at 1 every 5s (12/min sustained).
const AUTH_LIMITER = new RateLimiter(5, 0.2);
const RATE_LIMITED_AUTH_PATHS = ['/auth/login', '/auth/register', '/auth/google'];

// caller-supplied page size, bounded — an unchecked ?limit=10000000 would have
// one request scan and serialize the whole event store. Junk -> default.
const MAX_EVENTS_LIMIT = 200;
export function clampLimit(raw: string | undefined): number | undefined {
  const n = Number(raw);
  if (!raw || !Number.isFinite(n) || n < 1) return undefined;
  return Math.min(Math.floor(n), MAX_EVENTS_LIMIT);
}

export interface EventTrace {
  eventId: string;
  event: NormalizedEvent | undefined;
  alerts: Alert[];
  incidents: Incident[];
}

export interface RealtimeOptions {
  getMetrics?: () => unknown;
  getIncidentDetail?: (id: string) => Promise<IncidentDetail | undefined>;
  patchIncident?: (
    id: string,
    input: IncidentPatch,
    actor: Actor | null,
  ) => Promise<PatchIncidentResult>;
  queryIncidents?: (question: string) => Promise<IncidentQueryResult>;
  getRecentActivity?: () => Promise<RecentActivity>;
  getSocMetrics?: (days: number) => Promise<SocMetrics>;
  listUsers?: () => Promise<PublicUser[]>;
  listAdminUsers?: () => Promise<AdminUser[]>;
  setUserRole?: (actor: Actor | null, userId: string, role: Role) => Promise<SetRoleResult>;
  listAudit?: (limit: number) => Promise<AuditEntry[]>;
  // POST /ingest; absent = the route answers 404 (no INGEST_TOKENS configured)
  ingest?: {
    checkToken: (token: string | undefined) => boolean;
    publish: (records: RawLog[]) => Promise<void>;
  };
  searchEvents?: (params: EventSearchParams) => Promise<NormalizedEvent[]>;
  getEventTrace?: (eventId: string) => Promise<EventTrace>;
  getSystemHealth?: () => Promise<SystemHealth>;
  auth: AuthService;
  corsOrigins?: string[]; // see CORS_ORIGIN in @argus/config
  // see TRUST_PROXY in @argus/config — decides what req.ip (the rate-limit key) is
  trustProxy?: AppConfig['TRUST_PROXY'];
  // source-IP -> map location for incident rows (apps/api/src/geo)
  locate?: (ip: string) => GeoPoint | null;
}

export async function createRealtimeServer(bus: Bus, port: number, opts: RealtimeOptions) {
  const app = Fastify({ trustProxy: opts.trustProxy ?? false });
  app.decorateRequest('actor', null);
  await app.register(websocketPlugin);

  const corsOrigins = opts.corsOrigins ?? ['*'];
  // Access-Control-Allow-Origin takes exactly one origin, so reflect the
  // caller's only when it's on the list (and say so with Vary for caches).
  const allowedOrigin = (origin: string | undefined): string | undefined => {
    if (corsOrigins.includes('*')) return '*';
    return origin && corsOrigins.includes(origin) ? origin : undefined;
  };

  // every early response below does `return reply` — in an async hook that's
  // what tells Fastify the request is finished; without it the remaining hooks
  // (and the route handler) still run after a 429/401/403 was already sent.
  app.addHook('onRequest', async (req, reply) => {
    reply
      .header('x-content-type-options', 'nosniff')
      .header('x-frame-options', 'DENY')
      .header('referrer-policy', 'no-referrer')
      .header('cache-control', 'no-store') // live security data — nothing worth caching
      .header('vary', 'origin');

    const origin = req.headers.origin;
    const allowed = allowedOrigin(origin);
    if (allowed) reply.header('access-control-allow-origin', allowed);

    // CORS doesn't cover WebSockets — any site can open one to us. Bearer
    // tokens (not cookies) already make cross-site socket hijacking useless,
    // but there's no reason to accept a handshake from a foreign page either.
    if (req.url.startsWith('/ws') && origin && !allowed) {
      return reply.code(403).send({ error: 'origin not allowed' });
    }

    // browsers preflight any POST with a JSON body (auth/login etc. all
    // qualify) — Fastify has no route for OPTIONS, so without this it 404s
    // and the preflight (and therefore the real request) is rejected.
    if (req.method === 'OPTIONS') {
      return reply
        .header('access-control-allow-methods', 'GET, POST, PATCH, DELETE, OPTIONS')
        .header('access-control-allow-headers', 'content-type, authorization')
        .code(204)
        .send();
    }
  });

  app.addHook('onRequest', async (req, reply) => {
    if (req.url.startsWith('/healthz') || req.url.startsWith('/ws')) return;
    if (!REQUEST_LIMITER.tryConsume(req.ip)) {
      return reply.code(429).send({ error: 'rate limited, try again shortly' });
    }
  });

  app.addHook('onRequest', async (req, reply) => {
    if (!RATE_LIMITED_AUTH_PATHS.some((path) => req.url.startsWith(path))) return;
    if (!AUTH_LIMITER.tryConsume(req.ip)) {
      return reply.code(429).send({ error: 'too many attempts, try again shortly' });
    }
  });

  app.addHook('onRequest', async (req, reply) => {
    if (!opts.auth.isRequired()) return; // open dev install, no account yet — gate is a no-op
    if (UNGATED_PATHS.some((path) => req.url.startsWith(path))) return;

    const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    const queryToken = (req.query as { token?: string } | undefined)?.token;
    const token = bearer ?? queryToken;

    const payload = token ? await opts.auth.verify(token) : undefined;
    if (!payload) {
      return reply.code(401).send({ error: 'unauthorized' });
    }
    if (!canAccess(payload.role, req.method, req.url)) {
      return reply
        .code(403)
        .send({ error: payload.role === 'viewer' ? 'read-only account' : 'admins only' });
    }
    req.actor = { userId: payload.sub, email: payload.email, role: payload.role };
  });

  const sockets = new Set<WebSocket>();

  app.get('/ws', { websocket: true }, (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });

  app.get('/healthz', async () => ({ status: 'ok', clients: sockets.size }));

  app.get('/auth/status', async () => ({
    required: opts.auth.isRequired(),
    registration: opts.auth.registrationOpen,
  }));

  app.post('/auth/register', async (req, reply) => {
    const { email, password } = (req.body ?? {}) as { email?: string; password?: string };
    if (!email?.includes('@') || !password || password.length < 8) {
      reply.code(400);
      return { error: 'valid email and password (min 8 chars) required' };
    }
    const registered = await opts.auth.register(email, password);
    if (!registered.ok) {
      reply.code(registered.error === 'disabled' ? 403 : 409);
      return {
        error:
          registered.error === 'disabled'
            ? 'sign-up is disabled on this instance'
            : 'account already exists',
      };
    }
    return { token: registered.result.token };
  });

  app.post('/auth/login', async (req, reply) => {
    const { email, password } = (req.body ?? {}) as { email?: string; password?: string };
    const result = email && password ? await opts.auth.login(email, password) : undefined;
    if (!result) {
      reply.code(401);
      return { error: 'invalid email or password' };
    }
    return { token: result.token };
  });

  app.post('/auth/google', async (req, reply) => {
    const { credential } = (req.body ?? {}) as { credential?: string };
    const result = credential ? await opts.auth.loginWithGoogle(credential) : undefined;
    if (!result) {
      reply.code(401);
      return { error: 'invalid Google credential' };
    }
    return { token: result.token };
  });

  app.get('/metrics', async () => opts.getMetrics?.() ?? {});

  app.get('/incidents', async () => {
    const empty: RecentActivity = {
      incidents: [],
      ruleCounts: {},
      hourlyActivity: Array(24).fill(0),
    };
    const activity = (await opts.getRecentActivity?.()) ?? empty;
    return {
      ...activity,
      incidents: activity.incidents.map((row) => ({
        ...row,
        geo: opts.locate?.(row.incident.correlationKey) ?? null,
      })),
    };
  });

  app.get('/incidents/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const detail = await opts.getIncidentDetail?.(id);
    if (!detail) {
      reply.code(404);
      return { error: 'incident not found' };
    }
    return req.actor?.role === 'viewer'
      ? { ...detail, activity: redactActors(detail.activity) }
      : detail;
  });

  app.patch('/incidents/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = IncidentPatch.safeParse(req.body);
    if (!body.success) {
      reply.code(400);
      return { error: 'invalid patch body' };
    }

    const result = await opts.patchIncident?.(id, body.data, req.actor);
    if (!result) {
      reply.code(404);
      return { error: 'incident not found' };
    }
    if (!result.ok) {
      reply.code(result.error === 'not_found' ? 404 : 400);
      return { error: result.error };
    }

    bus.emit('incident.status_changed', { incident: result.incident });
    return result.incident;
  });

  app.post('/incidents/query', async (req, reply) => {
    const { question } = (req.body ?? {}) as { question?: string };
    if (!question?.trim()) {
      reply.code(400);
      return { error: 'question required' };
    }
    return (await opts.queryIncidents?.(question)) ?? { filter: {}, incidents: [] };
  });

  app.get('/soc-metrics', async (req, reply) => {
    const { days } = req.query as { days?: string };
    const metrics = await opts.getSocMetrics?.(clampDays(days));
    if (!metrics) {
      reply.code(503);
      return { error: 'metrics unavailable' };
    }
    return metrics;
  });

  app.get('/users', async () => ({ users: (await opts.listUsers?.()) ?? [] }));

  // admin only (canAccess): the gate stops everyone else before these run
  app.get('/admin/users', async () => ({ users: (await opts.listAdminUsers?.()) ?? [] }));

  app.patch('/admin/users/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = RolePatch.safeParse(req.body);
    if (!body.success) {
      reply.code(400);
      return { error: 'invalid role' };
    }
    const result = await opts.setUserRole?.(req.actor, id, body.data.role);
    if (!result || !result.ok) {
      const error = result?.error ?? 'not_found';
      reply.code(error === 'not_found' ? 404 : 409);
      return { error };
    }
    opts.auth.forgetRole(id);
    return result.user;
  });

  app.get('/admin/audit', async (req) => {
    const { limit } = req.query as { limit?: string };
    return { entries: (await opts.listAudit?.(clampLimit(limit) ?? 100)) ?? [] };
  });

  // its own scope, so its lenient body parsing stays its own: shippers differ
  // in how they frame a batch (a JSON array, or newline-delimited JSON sent
  // as application/json, application/x-ndjson or text/plain). Whatever isn't
  // one JSON document is handed on as a string, which parseIngestBody splits
  // into one record per line.
  await app.register(async (scope) => {
    scope.removeContentTypeParser(['application/json', 'text/plain']);
    scope.addContentTypeParser(
      ['application/json', 'application/x-ndjson', 'text/plain'],
      { parseAs: 'string' },
      (_req, body, done) => {
        const text = body as string;
        try {
          done(null, JSON.parse(text));
        } catch {
          done(null, text);
        }
      },
    );

    scope.post('/ingest', { bodyLimit: 1024 * 1024 }, async (req, reply) => {
      if (!opts.ingest) {
        reply.code(404);
        return { error: 'ingest is not enabled on this instance' };
      }
      const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, '');
      if (!opts.ingest.checkToken(bearer)) {
        req.log.warn({ ip: req.ip }, 'ingest: rejected token');
        reply.code(401);
        return { error: 'invalid ingest token' };
      }
      const { source } = req.query as { source?: string };
      const defaultSource = source === undefined ? undefined : Source.safeParse(source);
      if (defaultSource && !defaultSource.success) {
        reply.code(400);
        return { error: `source must be one of ${Source.options.join(', ')}` };
      }
      const result = parseIngestBody(req.body, defaultSource?.data);
      if ('error' in result) {
        reply.code(400);
        return result;
      }
      await opts.ingest.publish(result.records);
      reply.code(202);
      return { accepted: result.records.length, rejected: result.rejected };
    });
  });

  app.get('/events', async (req) => {
    const { q, source, limit } = req.query as { q?: string; source?: string; limit?: string };
    const events = (await opts.searchEvents?.({ q, source, limit: clampLimit(limit) })) ?? [];
    return { events };
  });

  app.get('/events/:eventId/trace', async (req) => {
    const { eventId } = req.params as { eventId: string };
    const trace = await opts.getEventTrace?.(eventId);
    return trace ?? { eventId, event: undefined, alerts: [], incidents: [] };
  });

  app.get('/system/health', async () => {
    if (!opts.getSystemHealth) {
      return {
        kafka: { ok: false, consumerLag: [] },
        search: { ok: false, backend: 'elasticsearch', status: null },
        postgres: { ok: false, latencyMs: null },
      };
    }
    return opts.getSystemHealth();
  });

  const send = (payload: unknown): void => {
    const json = JSON.stringify(payload);
    for (const socket of sockets) socket.send(json);
  };

  const broadcastIncident =
    (type: 'incident.created' | 'incident.updated') => (event: IncidentEvent) =>
      send({ type, ...event, geo: opts.locate?.(event.incident.correlationKey) ?? null });
  bus.on('incident.created', broadcastIncident('incident.created'));
  bus.on('incident.updated', broadcastIncident('incident.updated'));
  bus.on('incident.status_changed', ({ incident }) =>
    send({ type: 'incident.status_changed', incident }),
  );
  bus.on('summary.ready', (summary: IncidentSummary) => send({ type: 'summary.ready', summary }));
  bus.on('event.normalized', (event: NormalizedEvent) => send({ type: 'event.normalized', event }));
  bus.on('alert.raised', (alert: Alert) => send({ type: 'alert.raised', alert }));

  await app.listen({ port, host: '0.0.0.0' });
  return app;
}
