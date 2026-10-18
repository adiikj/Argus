import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createBus } from '../../src/bus/index.js';
import { createRealtimeServer } from '../../src/realtime/server.js';
import type { AuthService } from '../../src/auth/index.js';
import { createTokenCheck } from '../../src/ingest/index.js';
import { parseRawLog } from '../../src/parser/index.js';
import {
  maskEmail,
  plainIp,
  securityEventLog,
  type SecurityEvent,
} from '../../src/selfmon/index.js';

describe('maskEmail', () => {
  it('keeps the first letter, the length and the domain', () => {
    expect(maskEmail('Aditya@Argus.buzz')).toBe('a*6@argus.buzz');
    expect(maskEmail(' analyst@argus.buzz ')).toBe('a*7@argus.buzz');
    expect(maskEmail('not-an-email')).toBe('n*12');
    expect(maskEmail('')).toBeUndefined();
    expect(maskEmail(undefined)).toBeUndefined();
  });
});

describe('securityEventLog', () => {
  it('round-trips through the argus parser', () => {
    const log = securityEventLog({
      ip: '::ffff:203.0.113.9',
      method: 'POST',
      path: '/auth/login',
      status: 401,
      outcome: 'failure',
      reason: 'bad email or password',
      user: 'a*6@argus.buzz',
      userAgent: 'curl/8.9',
    });
    expect(log.source).toBe('argus');
    expect(parseRawLog(log)).toMatchObject({
      source: 'argus',
      sourceIp: '203.0.113.9',
      outcome: 'failure',
      username: 'a*6@argus.buzz',
      method: 'POST',
      path: '/auth/login',
      statusCode: 401,
      userAgent: 'curl/8.9',
    });
  });

  it('unwraps IPv4-mapped addresses only', () => {
    expect(plainIp('::ffff:198.51.100.4')).toBe('198.51.100.4');
    expect(plainIp('2001:db8::1')).toBe('2001:db8::1');
  });
});

describe('api security events', () => {
  const EMAIL = 'analyst@argus.buzz';
  const auth: AuthService = {
    googleClientId: 'x',
    registrationOpen: false,
    isRequired: () => true,
    register: async () => ({ ok: false, error: 'disabled' }),
    login: async (email, password) =>
      password === 'right-password'
        ? { token: 't', user: { userId: 'u', email, name: null, role: 'analyst' } }
        : undefined,
    loginWithGoogle: async () => undefined,
    verify: async (token) =>
      token === 'viewer' ? { sub: 'v', email: 'demo@argus.buzz', role: 'viewer' } : undefined,
    forgetRole: () => {},
  };

  let app: FastifyInstance | undefined;
  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  async function start() {
    const events: SecurityEvent[] = [];
    app = await createRealtimeServer(createBus(), 0, {
      auth,
      onSecurityEvent: (e) => events.push(e),
      ingest: { checkToken: createTokenCheck(['k'.repeat(32)]), publish: vi.fn() },
    });
    return { app, events };
  }

  const login = (server: FastifyInstance, password: string) =>
    server.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: EMAIL, password },
      headers: { 'user-agent': 'test-agent' },
    });

  it('records failed and successful console logins, with the email masked', async () => {
    const { app, events } = await start();
    await login(app, 'wrong');
    await login(app, 'right-password');
    expect(events).toEqual([
      expect.objectContaining({
        path: '/auth/login',
        status: 401,
        outcome: 'failure',
        user: 'a*7@argus.buzz',
        userAgent: 'test-agent',
      }),
      expect.objectContaining({ status: 200, outcome: 'success', user: 'a*7@argus.buzz' }),
    ]);
  });

  it('records a rejected session token but not a missing one, without the query string', async () => {
    const { app, events } = await start();
    await app.inject({ url: '/incidents' });
    expect(events).toEqual([]);
    await app.inject({ url: '/ws?token=forged.jwt.value' });
    expect(events).toEqual([
      expect.objectContaining({ path: '/ws', status: 401, reason: 'invalid session token' }),
    ]);
    expect(JSON.stringify(events)).not.toContain('forged');
  });

  it('records role denials and bad ingest tokens', async () => {
    const { app, events } = await start();
    await app.inject({
      method: 'PATCH',
      url: '/incidents/x',
      headers: { authorization: 'Bearer viewer' },
      payload: {},
    });
    await app.inject({
      method: 'POST',
      url: '/ingest?source=nginx',
      headers: { authorization: 'Bearer nope', 'content-type': 'text/plain' },
      payload: 'x',
    });
    expect(events).toEqual([
      expect.objectContaining({
        status: 403,
        user: 'd*4@argus.buzz',
        reason: 'viewer not allowed',
      }),
      expect.objectContaining({ path: '/ingest', status: 401, reason: 'invalid ingest token' }),
    ]);
  });

  it('never lets a shipper inject argus events', async () => {
    const { app } = await start();
    const res = await app.inject({
      method: 'POST',
      url: '/ingest?source=argus',
      headers: { authorization: `Bearer ${'k'.repeat(32)}`, 'content-type': 'text/plain' },
      payload: 'x',
    });
    expect(res.statusCode).toBe(400);
  });
});
