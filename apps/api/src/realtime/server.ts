import Fastify from 'fastify';
import websocketPlugin, { type WebSocket } from '@fastify/websocket';
import type { IncidentSummary } from '@argus/contracts';
import type { Bus, IncidentEvent } from '../bus/index.js';

export interface RealtimeOptions {
  getMetrics?: () => unknown;
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
