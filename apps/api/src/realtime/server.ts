import Fastify from 'fastify';
import websocketPlugin, { type WebSocket } from '@fastify/websocket';
import type { Bus } from '../bus/index.js';

export async function createRealtimeServer(bus: Bus, port: number) {
  const app = Fastify();
  await app.register(websocketPlugin);

  const sockets = new Set<WebSocket>();

  app.get('/ws', { websocket: true }, (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });

  bus.on('alert.created', (alert) => {
    const payload = JSON.stringify({ type: 'alert.created', alert });
    for (const socket of sockets) socket.send(payload);
  });

  await app.listen({ port, host: '0.0.0.0' });
  return app;
}
