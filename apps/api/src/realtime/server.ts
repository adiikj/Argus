import Fastify from 'fastify';
import websocketPlugin, { type WebSocket } from '@fastify/websocket';
import type { Bus } from '../bus/index.js';

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

  // fan out every alert to every connected dashboard client. In-memory only
  bus.on('alert.created', (alert) => {
    const payload = JSON.stringify({ type: 'alert.created', alert });
    for (const socket of sockets) socket.send(payload);
  });

  await app.listen({ port, host: '0.0.0.0' });
  return app;
}
