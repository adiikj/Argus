import Fastify from 'fastify';
import websocketPlugin, { type WebSocket } from '@fastify/websocket';
import type { Bus, IncidentEvent } from '../bus/index.js';

export interface RealtimeOptions {
  // supplied by the composition root; kept as a plain callback so realtime
  // doesn't import the metrics module
  getMetrics?: () => unknown;
}

export async function createRealtimeServer(bus: Bus, port: number, opts: RealtimeOptions = {}) {
  const app = Fastify();
  await app.register(websocketPlugin);

  // the dashboard reads /healthz + /metrics from a different origin
  app.addHook('onRequest', async (_req, reply) => {
    reply.header('access-control-allow-origin', '*');
  });

  const sockets = new Set<WebSocket>();

  app.get('/ws', { websocket: true }, (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });

  //  liveness + the pipeline counters
  app.get('/healthz', async () => ({ status: 'ok', clients: sockets.size }));
  app.get('/metrics', async () => opts.getMetrics?.() ?? {});

  // fan out every incident create/update to every connected dashboard client.
  // In-memory only — no queued history for clients that connect late.
  const broadcast = (type: 'incident.created' | 'incident.updated') => (event: IncidentEvent) => {
    const payload = JSON.stringify({ type, ...event });
    for (const socket of sockets) socket.send(payload);
  };
  bus.on('incident.created', broadcast('incident.created'));
  bus.on('incident.updated', broadcast('incident.updated'));

  await app.listen({ port, host: '0.0.0.0' });
  return app;
}
