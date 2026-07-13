import Fastify from 'fastify';
import websocketPlugin, { type WebSocket } from '@fastify/websocket';
import type { Alert, Incident, IncidentSummary, NormalizedEvent } from '@argus/contracts';
import type { Bus, IncidentEvent } from '../bus/index.js';
import type { IncidentDetail } from '../incident/index.js';
import type { EventSearchParams } from '../storage/index.js';
import type { SystemHealth } from '../system/index.js';
import type { AuthService } from '../auth/index.js';
import { RateLimiter } from './rate-limit.js';

const UNGATED_PATHS = ['/healthz', '/auth/login', '/auth/register', '/auth/google', '/auth/status'];

// 40 immediate requests, refilling at 5/sec (300/min sustained) — comfortably
// above normal dashboard polling (/metrics every 3s, /system/health every 5s
// per open tab), but still a real ceiling against a hammering script.
const REQUEST_LIMITER = new RateLimiter(40, 5);

// tighter brute-force ceiling on the auth endpoints specifically: 5 immediate
// attempts, refilling at 1 every 5s (12/min sustained).
const AUTH_LIMITER = new RateLimiter(5, 0.2);

export interface EventTrace {
  eventId: string;
  event: NormalizedEvent | undefined;
  alerts: Alert[];
  incidents: Incident[];
}

export interface RealtimeOptions {
  getMetrics?: () => unknown;
  getIncidentDetail?: (id: string) => Promise<IncidentDetail | undefined>;
  searchEvents?: (params: EventSearchParams) => Promise<NormalizedEvent[]>;
  getEventTrace?: (eventId: string) => Promise<EventTrace>;
  getSystemHealth?: () => Promise<SystemHealth>;
  auth: AuthService;
  corsOrigin?: string;
}

export async function createRealtimeServer(bus: Bus, port: number, opts: RealtimeOptions) {
  const app = Fastify();
  await app.register(websocketPlugin);

  const corsOrigin = opts.corsOrigin ?? '*';
  app.addHook('onRequest', async (_req, reply) => {
    reply.header('access-control-allow-origin', corsOrigin);
  });

  app.addHook('onRequest', async (req, reply) => {
    if (req.url.startsWith('/healthz') || req.url.startsWith('/ws')) return;
    if (!REQUEST_LIMITER.tryConsume(req.ip)) {
      reply.code(429).send({ error: 'rate limited — try again shortly' });
    }
  });

  app.addHook('onRequest', async (req, reply) => {
    if (!req.url.startsWith('/auth/login') && !req.url.startsWith('/auth/register')) return;
    if (!AUTH_LIMITER.tryConsume(req.ip)) {
      reply.code(429).send({ error: 'too many attempts — try again shortly' });
    }
  });

  app.addHook('onRequest', async (req, reply) => {
    if (!opts.auth.isRequired()) return; // no account registered yet — gate is a no-op
    if (UNGATED_PATHS.some((path) => req.url.startsWith(path))) return;

    const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    const queryToken = (req.query as { token?: string } | undefined)?.token;
    const token = bearer ?? queryToken;

    const payload = token ? await opts.auth.verify(token) : undefined;
    if (!payload) {
      reply.code(401).send({ error: 'unauthorized' });
    }
  });

  const sockets = new Set<WebSocket>();

  app.get('/ws', { websocket: true }, (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });

  app.get('/healthz', async () => ({ status: 'ok', clients: sockets.size }));

  app.get('/auth/status', async () => ({ required: opts.auth.isRequired() }));

  app.post('/auth/register', async (req, reply) => {
    const { email, password } = (req.body ?? {}) as { email?: string; password?: string };
    if (!email?.includes('@') || !password || password.length < 8) {
      reply.code(400);
      return { error: 'valid email and password (min 8 chars) required' };
    }
    const result = await opts.auth.register(email, password);
    if (!result) {
      reply.code(409);
      return { error: 'account already exists' };
    }
    return { token: result.token };
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

  app.get('/incidents/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const detail = await opts.getIncidentDetail?.(id);
    if (!detail) {
      reply.code(404);
      return { error: 'incident not found' };
    }
    return detail;
  });

  app.get('/events', async (req) => {
    const { q, source, limit } = req.query as { q?: string; source?: string; limit?: string };
    const events =
      (await opts.searchEvents?.({ q, source, limit: limit ? Number(limit) : undefined })) ?? [];
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
      send({ type, ...event });
  bus.on('incident.created', broadcastIncident('incident.created'));
  bus.on('incident.updated', broadcastIncident('incident.updated'));
  bus.on('summary.ready', (summary: IncidentSummary) => send({ type: 'summary.ready', summary }));
  bus.on('event.normalized', (event: NormalizedEvent) => send({ type: 'event.normalized', event }));
  bus.on('alert.raised', (alert: Alert) => send({ type: 'alert.raised', alert }));

  await app.listen({ port, host: '0.0.0.0' });
  return app;
}
