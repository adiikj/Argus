import Fastify from 'fastify';
import websocketPlugin, { type WebSocket } from '@fastify/websocket';
import type { Bus } from '../bus/index.js';

export interface RealtimeOptions {
  // supplied by the composition root; kept as a plain callback so realtime
  // doesn't import the metrics module (module boundaries, §2).
  getMetrics?: () => unknown;
}

export async function createRealtimeServer(bus: Bus, port: number, opts: RealtimeOptions = {}) {
  const app = Fastify();
  await app.register(websocketPlugin);

  const sockets = new Set<WebSocket>();

  app.get('/ws', { websocket: true }, (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });

  // ops surface (§10): liveness + the pipeline counters
  app.get('/healthz', async () => ({ status: 'ok', clients: sockets.size }));
  app.get('/metrics', async () => opts.getMetrics?.() ?? {});

  // fan out every alert to every connected dashboard client. In-memory only
  // (single instance); documented V2 scale-out = Redis pub/sub (§9).
  bus.on('alert.created', (alert) => {
    const payload = JSON.stringify({ type: 'alert.created', alert });
    for (const socket of sockets) socket.send(payload);
  });

  await app.listen({ port, host: '0.0.0.0' });
  return app;
}
