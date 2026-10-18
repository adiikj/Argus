import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { RawLog } from '@argus/contracts';
import { createBus } from '../../src/bus/index.js';
import { createRealtimeServer } from '../../src/realtime/server.js';
import { createTokenCheck, MAX_RECORDS, parseIngestBody } from '../../src/ingest/index.js';
import type { AuthService } from '../../src/auth/index.js';
import { parseRawLog } from '../../src/parser/index.js';

const NOW = Date.parse('2026-10-18T09:00:00.000Z');
const NGINX_LINE =
  '203.0.113.7 - - [18/Oct/2026:08:59:58 +0000] "GET /.env HTTP/1.1" 404 162 "-" "zgrab/0.x"';

function records(result: ReturnType<typeof parseIngestBody>) {
  if ('error' in result) throw new Error(result.error);
  return result;
}

describe('parseIngestBody', () => {
  it('reads a Vector JSON batch (message + ISO timestamp)', () => {
    const { records: logs, rejected } = records(
      parseIngestBody(
        [{ message: NGINX_LINE, timestamp: '2026-10-18T08:59:58.123Z', host: 'vm', file: '/x' }],
        'nginx',
        NOW,
      ),
    );
    expect(rejected).toBe(0);
    expect(logs[0]).toMatchObject({
      source: 'nginx',
      message: NGINX_LINE,
      timestamp: '2026-10-18T08:59:58.123Z',
    });
    // and the result really is what the parser stage expects
    expect(parseRawLog(logs[0]!)).toMatchObject({ sourceIp: '203.0.113.7', path: '/.env' });
  });

  it('reads Fluent Bit records (log key, epoch-seconds date)', () => {
    const { records: logs } = records(
      parseIngestBody([{ date: 1_792_314_000.5, log: `${NGINX_LINE}\n` }], 'nginx', NOW),
    );
    expect(logs[0]).toMatchObject({
      message: NGINX_LINE,
      timestamp: new Date(1_792_314_000_500).toISOString(),
    });
  });

  it("reads Fluent Bit's systemd input (MESSAGE key)", () => {
    const line = 'Failed password for invalid user admin from 203.0.113.9 port 40022 ssh2';
    const { records: logs } = records(
      parseIngestBody([{ timestamp: '2026-10-18T08:59:00.123456Z', MESSAGE: line }], 'auth', NOW),
    );
    expect(logs[0]).toMatchObject({ message: line, timestamp: '2026-10-18T08:59:00.123Z' });
    expect(parseRawLog(logs[0]!)).toMatchObject({ username: 'admin', outcome: 'failure' });
  });

  it('reads NDJSON and plain text, one record per line', () => {
    const body = `{"message":"one","source":"auth"}\nplain two\n\n{not json\n`;
    const { records: logs } = records(parseIngestBody(body, 'nginx', NOW));
    expect(logs.map((l) => [l.source, l.message])).toEqual([
      ['auth', 'one'],
      ['nginx', 'plain two'],
      ['nginx', '{not json'],
    ]);
  });

  it('lets a record name its own source, and rejects unknown ones', () => {
    const { records: logs, rejected } = records(
      parseIngestBody(
        [{ message: 'a', source: 'auth' }, { message: 'b', source: 'windows' }, { message: 'c' }],
        undefined,
        NOW,
      ),
    );
    expect(logs.map((l) => l.message)).toEqual(['a']);
    expect(rejected).toBe(2); // bad source, and no source at all
  });

  it('falls back to the receive time for a missing or future timestamp', () => {
    const { records: logs } = records(
      parseIngestBody(
        [
          { message: 'a' },
          { message: 'b', timestamp: '2027-01-01T00:00:00Z' },
          { message: 'c', timestamp: 'yesterday' },
        ],
        'auth',
        NOW,
      ),
    );
    expect(new Set(logs.map((l) => l.timestamp))).toEqual(new Set([new Date(NOW).toISOString()]));
  });

  it('rejects empty, oversized and non-string messages', () => {
    const { records: logs, rejected } = records(
      parseIngestBody(
        [{ message: '' }, { message: 'x'.repeat(17_000) }, { message: 42 }, 7, null],
        'auth',
        NOW,
      ),
    );
    expect(logs).toEqual([]);
    expect(rejected).toBe(5);
  });

  it('caps the batch size', () => {
    const tooMany = Array.from({ length: MAX_RECORDS + 1 }, () => 'x');
    expect(parseIngestBody(tooMany, 'auth', NOW)).toHaveProperty('error');
    expect(parseIngestBody(undefined, 'auth', NOW)).toHaveProperty('error');
  });
});

describe('createTokenCheck', () => {
  const a = 'a'.repeat(32);
  const b = 'b'.repeat(32);

  it('accepts any configured token, nothing else', () => {
    const check = createTokenCheck([a, b]);
    expect(check(a)).toBe(true);
    expect(check(b)).toBe(true);
    expect(check('a'.repeat(31))).toBe(false);
    expect(check(undefined)).toBe(false);
    expect(check('')).toBe(false);
  });

  it('accepts nothing when no tokens are configured', () => {
    expect(createTokenCheck([])('')).toBe(false);
  });
});

describe('POST /ingest', () => {
  const TOKEN = 'c'.repeat(32);
  // the user login gate is on, and nobody's session token works here
  const auth: AuthService = {
    googleClientId: undefined,
    registrationOpen: false,
    isRequired: () => true,
    register: async () => ({ ok: false, error: 'disabled' }),
    login: async () => undefined,
    loginWithGoogle: async () => undefined,
    verify: async (token) =>
      token === 'analyst-session' ? { sub: 'u', email: 'u@x.io', role: 'analyst' } : undefined,
    forgetRole: () => {},
  };

  let app: FastifyInstance | undefined;
  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  async function start(enabled = true) {
    const publish = vi.fn(async (_records: RawLog[]) => {});
    app = await createRealtimeServer(createBus(), 0, {
      auth,
      ingest: enabled ? { checkToken: createTokenCheck([TOKEN]), publish } : undefined,
    });
    return { app, publish };
  }

  const post = (
    server: FastifyInstance,
    token: string | undefined,
    payload: string,
    type = 'application/json',
    url = '/ingest?source=nginx',
  ) =>
    server.inject({
      method: 'POST',
      url,
      headers: {
        'content-type': type,
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      payload,
    });

  it('publishes an accepted batch with 202', async () => {
    const { app, publish } = await start();
    const res = await post(app, TOKEN, JSON.stringify([{ message: NGINX_LINE }, { foo: 1 }]));
    expect(res.statusCode).toBe(202);
    expect(res.json()).toEqual({ accepted: 1, rejected: 1 });
    expect(publish.mock.calls[0]![0]).toHaveLength(1);
  });

  it('takes NDJSON and plain text bodies', async () => {
    const { app, publish } = await start();
    expect(
      (await post(app, TOKEN, `${NGINX_LINE}\n${NGINX_LINE}\n`, 'application/x-ndjson')).statusCode,
    ).toBe(202);
    expect((await post(app, TOKEN, NGINX_LINE, 'text/plain')).statusCode).toBe(202);
    expect(publish.mock.calls.map((c) => c[0].length)).toEqual([2, 1]);
  });

  it('takes newline-delimited JSON sent as application/json', async () => {
    const { app, publish } = await start();
    const body = `${JSON.stringify({ message: NGINX_LINE })}\n${JSON.stringify({ message: NGINX_LINE })}\n`;
    const res = await post(app, TOKEN, body);
    expect(res.statusCode).toBe(202);
    expect(res.json()).toEqual({ accepted: 2, rejected: 0 });
  });

  it('keeps strict JSON parsing on every other route', async () => {
    const { app } = await start();
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: '{"email": ',
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects a missing or wrong token, and user sessions', async () => {
    const { app, publish } = await start();
    for (const token of [undefined, 'd'.repeat(32), 'analyst-session']) {
      expect((await post(app, token, '[]')).statusCode).toBe(401);
    }
    expect(publish).not.toHaveBeenCalled();
  });

  it('rejects an unknown source', async () => {
    const { app } = await start();
    const res = await post(app, TOKEN, '[]', 'application/json', '/ingest?source=windows');
    expect(res.statusCode).toBe(400);
  });

  it('is off without configured tokens', async () => {
    const { app } = await start(false);
    expect((await post(app, TOKEN, '[]')).statusCode).toBe(404);
  });
});
