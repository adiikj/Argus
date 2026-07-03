import Fastify from 'fastify';
import websocketPlugin, { type WebSocket } from '@fastify/websocket';
import type { Alert, Incident, IncidentSummary, NormalizedEvent } from '@argus/contracts';
import type { Bus, IncidentEvent } from '../bus/index.js';
import type { IncidentDetail } from '../incident/index.js';
import type { EventSearchParams } from '../storage/index.js';

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
}

export async function createRealtimeServer(bus: Bus, port: number, opts: RealtimeOptions = {}) {
  const app = Fastify();
  await app.register(websocketPlugin);

  app.addHook('onRequest', async (_req, reply) => {
    reply.header('access-control-allow-origin', '*');
  });

  const sockets = new Set<WebSocket>();

  app.get('/ws', { websocket: true }, (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });

  app.get('/healthz', async () => ({ status: 'ok', clients: sockets.size }));
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

  await app.listen({ port, host: '0.0.0.0' });
  return app;
}
