import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Role } from '@argus/contracts';
import { createBus } from '../../src/bus/index.js';
import { clampLimit, createRealtimeServer } from '../../src/realtime/server.js';
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
    forgetRole: () => {},
  };
}

let app: FastifyInstance | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

async function start(auth: AuthService, corsOrigins?: string[]) {
  const patchIncident = vi.fn(async () => ({ ok: false as const, error: 'not_found' as const }));
  app = await createRealtimeServer(createBus(), 0, {
    auth,
    patchIncident,
    listUsers: async () => [],
    corsOrigins,
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

describe('api CORS + origin checks', () => {
  const DASHBOARD = 'https://argus.example.com';
  const open = () => stubAuth({ required: false, registrationOpen: true });

  it('reflects only listed origins', async () => {
    const { app } = await start(open(), [DASHBOARD, 'https://argus.vercel.app']);
    const ok = await app.inject({ url: '/healthz', headers: { origin: DASHBOARD } });
    expect(ok.headers['access-control-allow-origin']).toBe(DASHBOARD);
    expect(ok.headers['vary']).toContain('origin');

    const foreign = await app.inject({ url: '/healthz', headers: { origin: 'https://evil.test' } });
    expect(foreign.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('refuses a WebSocket handshake from a foreign page', async () => {
    const { app } = await start(open(), [DASHBOARD]);
    const res = await app.inject({ url: '/ws', headers: { origin: 'https://evil.test' } });
    expect(res.statusCode).toBe(403);
  });

  it("allows any origin with '*' (local dev)", async () => {
    const { app } = await start(open(), ['*']);
    const res = await app.inject({ url: '/healthz', headers: { origin: 'http://localhost:3000' } });
    expect(res.headers['access-control-allow-origin']).toBe('*');
  });

  it('sends baseline security headers', async () => {
    const { app } = await start(open());
    const res = await app.inject({ url: '/healthz' });
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['cache-control']).toBe('no-store');
  });
});

describe('clampLimit', () => {
  it('bounds the events page size', () => {
    expect(clampLimit('25')).toBe(25);
    expect(clampLimit('10000000')).toBe(200);
    expect(clampLimit('12.7')).toBe(12);
    expect(clampLimit(undefined)).toBeUndefined();
    expect(clampLimit('-5')).toBeUndefined();
    expect(clampLimit('abc')).toBeUndefined();
  });
});

describe('GET /incidents geo enrichment', () => {
  it('attaches each incident source location from the locator', async () => {
    const row = (ip: string) => ({
      incident: { incidentId: ip, correlationKey: ip } as never,
      latestAlert: {} as never,
    });
    const app = await createRealtimeServer(createBus(), 0, {
      auth: stubAuth({ required: false, registrationOpen: true }),
      getRecentActivity: async () => ({
        incidents: [row('203.0.113.5'), row('10.0.0.1')],
        ruleCounts: {},
        hourlyActivity: Array(24).fill(0),
      }),
      locate: (ip) =>
        ip === '203.0.113.5'
          ? { country: 'JP', countryName: 'Japan', lat: 1, lng: 2, source: 'simulated' }
          : null,
    });
    const body = (await app.inject({ url: '/incidents' })).json() as {
      incidents: Array<{ geo: unknown }>;
    };
    await app.close();
    expect(body.incidents.map((r) => r.geo)).toEqual([
      { country: 'JP', countryName: 'Japan', lat: 1, lng: 2, source: 'simulated' },
      null,
    ]);
  });
});

describe('admin routes + audit actor', () => {
  const as = (token: string) => ({ authorization: `Bearer ${token}` });

  it('keeps /admin/* for admins only', async () => {
    const setUserRole = vi.fn(async () => ({
      ok: true as const,
      user: { userId: 'x', email: 'x@example.com', name: null, role: 'viewer' as const },
    }));
    const app = await createRealtimeServer(createBus(), 0, {
      auth: stubAuth({ required: true, registrationOpen: false }),
      listAdminUsers: async () => [],
      setUserRole,
      listAudit: async () => [],
    });
    const roleChange = (token: string) =>
      app.inject({
        method: 'PATCH',
        url: '/admin/users/00000000-0000-4000-8000-000000000001',
        headers: as(token),
        payload: { role: 'viewer' },
      });
    try {
      for (const token of ['analyst', 'viewer']) {
        expect((await app.inject({ url: '/admin/users', headers: as(token) })).statusCode).toBe(
          403,
        );
        expect((await app.inject({ url: '/admin/audit', headers: as(token) })).statusCode).toBe(
          403,
        );
        expect((await roleChange(token)).statusCode).toBe(403);
      }
      expect(setUserRole).not.toHaveBeenCalled();

      expect((await app.inject({ url: '/admin/users', headers: as('admin') })).statusCode).toBe(
        200,
      );
      expect((await roleChange('admin')).statusCode).toBe(200);
      expect(setUserRole).toHaveBeenCalledWith(
        { userId: 'u', email: 'u@example.com', role: 'admin' },
        '00000000-0000-4000-8000-000000000001',
        'viewer',
      );
    } finally {
      await app.close();
    }
  });

  it('refuses to demote the last admin', async () => {
    const app = await createRealtimeServer(createBus(), 0, {
      auth: stubAuth({ required: true, registrationOpen: false }),
      setUserRole: async () => ({ ok: false, error: 'last_admin' }),
    });
    const res = await app.inject({
      method: 'PATCH',
      url: '/admin/users/u',
      headers: as('admin'),
      payload: { role: 'analyst' },
    });
    await app.close();
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: 'last_admin' });
  });

  it('passes the caller to patchIncident as the audit actor', async () => {
    const { app, patchIncident } = await start(
      stubAuth({ required: true, registrationOpen: false }),
    );
    await patch(app, 'analyst');
    expect(patchIncident).toHaveBeenCalledWith(
      '00000000-0000-0000-0000-000000000000',
      { status: 'acknowledged' },
      { userId: 'u', email: 'u@example.com', role: 'analyst' },
    );
  });

  it('hides actor emails from viewers on the incident activity trail', async () => {
    const entry = {
      id: '00000000-0000-4000-8000-000000000009',
      at: '2026-10-18T09:00:00.000Z',
      actor: { userId: 'a', email: 'admin@example.com', role: 'admin' as const },
      action: 'incident.status' as const,
      targetType: 'incident' as const,
      targetId: 'i',
      from: 'open',
      to: 'acknowledged',
    };
    const app = await createRealtimeServer(createBus(), 0, {
      auth: stubAuth({ required: true, registrationOpen: false }),
      getIncidentDetail: async () => ({
        incident: {} as never,
        alerts: [],
        summary: undefined,
        activity: [entry],
      }),
    });
    const read = async (token: string) =>
      (
        (await app.inject({ url: '/incidents/i', headers: as(token) })).json() as {
          activity: Array<{ actor: { email: string | null } }>;
        }
      ).activity[0]!.actor.email;
    try {
      expect(await read('analyst')).toBe('admin@example.com');
      expect(await read('viewer')).toBeNull();
    } finally {
      await app.close();
    }
  });
});
