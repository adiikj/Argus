import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Role } from '@argus/contracts';
import { createBus } from '../../src/bus/index.js';
import { createRealtimeServer } from '../../src/realtime/server.js';
import type { AuthService, RegisterResult } from '../../src/auth/index.js';

// stub auth: tokens are just role names, so each test picks its caller's role
function stubAuth(opts: { required: boolean; registrationOpen: boolean }): AuthService {
  return {
    googleClientId: undefined,
    registrationOpen: opts.registrationOpen,
    isRequired: () => opts.required,
    register: async (): Promise<RegisterResult> =>
      opts.registrationOpen ? { ok: false, error: 'taken' } : { ok: false, error: 'disabled' },
    login: async () => undefined,
    loginWithGoogle: async () => undefined,
    verify: async (token) =>
      ['admin', 'analyst', 'viewer'].includes(token)
        ? { sub: 'u', email: 'u@example.com', role: token as Role }
        : undefined,
  };
}

let app: FastifyInstance | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

async function start(auth: AuthService) {
  const patchIncident = vi.fn(async () => ({ ok: false as const, error: 'not_found' as const }));
  app = await createRealtimeServer(createBus(), 0, {
    auth,
    patchIncident,
    listUsers: async () => [],
  });
  return { app, patchIncident };
}

const patch = (server: FastifyInstance, token?: string) =>
  server.inject({
    method: 'PATCH',
    url: '/incidents/00000000-0000-0000-0000-000000000000',
    headers: token ? { authorization: `Bearer ${token}` } : {},
    payload: { status: 'acknowledged' },
  });

describe('api auth gate', () => {
  it('rejects requests without a valid token', async () => {
    const { app, patchIncident } = await start(
      stubAuth({ required: true, registrationOpen: false }),
    );
    expect((await patch(app)).statusCode).toBe(401);
    expect((await patch(app, 'garbage')).statusCode).toBe(401);
    expect(patchIncident).not.toHaveBeenCalled();
  });

  it('stops a viewer at the gate — the handler never runs', async () => {
    const { app, patchIncident } = await start(
      stubAuth({ required: true, registrationOpen: false }),
    );
    const res = await patch(app, 'viewer');
    expect(res.statusCode).toBe(403);
    expect(patchIncident).not.toHaveBeenCalled();
    expect(
      (await app.inject({ url: '/users', headers: { authorization: 'Bearer viewer' } })).statusCode,
    ).toBe(403);
  });

  it('lets an analyst through to the handler', async () => {
    const { app, patchIncident } = await start(
      stubAuth({ required: true, registrationOpen: false }),
    );
    expect((await patch(app, 'analyst')).statusCode).toBe(404); // stub says not_found
    expect(patchIncident).toHaveBeenCalledOnce();
  });

  it('reports registration state and refuses sign-up when closed', async () => {
    const { app } = await start(stubAuth({ required: true, registrationOpen: false }));
    const status = await app.inject({ url: '/auth/status' });
    expect(status.json()).toEqual({ required: true, registration: false });

    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'new@example.com', password: 'long-enough-pw' },
    });
    expect(res.statusCode).toBe(403);
  });
});
