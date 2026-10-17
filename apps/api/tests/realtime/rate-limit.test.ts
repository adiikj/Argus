import { describe, expect, it } from 'vitest';
import Fastify from 'fastify';
import { TrustProxy } from '@argus/config';
import { RateLimiter } from '../../src/realtime/rate-limit.js';

describe('RateLimiter', () => {
  it('allows a burst up to capacity, then refuses', () => {
    const limiter = new RateLimiter(3, 1);
    const now = 1_000_000;
    expect([1, 2, 3, 4].map(() => limiter.tryConsume('ip', now))).toEqual([
      true,
      true,
      true,
      false,
    ]);
  });

  it('refills over time', () => {
    const limiter = new RateLimiter(1, 1);
    expect(limiter.tryConsume('ip', 0)).toBe(true);
    expect(limiter.tryConsume('ip', 500)).toBe(false);
    expect(limiter.tryConsume('ip', 1_600)).toBe(true);
  });

  it('keeps separate buckets per key', () => {
    const limiter = new RateLimiter(1, 0.1);
    expect(limiter.tryConsume('a', 0)).toBe(true);
    expect(limiter.tryConsume('b', 0)).toBe(true);
    expect(limiter.tryConsume('a', 0)).toBe(false);
  });

  it('sweeps buckets that have fully refilled, but keeps drained ones', () => {
    const limiter = new RateLimiter(2, 1); // full again 2s after last use
    limiter.tryConsume('idle', 0);
    limiter.tryConsume('busy', 0);
    limiter.tryConsume('busy', 59_500);
    limiter.tryConsume('busy', 59_500);
    expect(limiter.size).toBe(2);

    // first call past the 60s sweep interval drops 'idle' (refilled long ago)
    // and keeps 'busy' (drained 0.5s ago, still owed tokens)
    expect(limiter.tryConsume('busy', 60_000)).toBe(false);
    expect(limiter.size).toBe(1);
  });
});

// the rate limiters key on req.ip, so what Fastify resolves it to behind a
// proxy is the security property that matters — pinned here end to end.
describe('client IP behind a proxy', () => {
  async function resolvedIp(trustProxy: string, xff: string): Promise<string> {
    const app = Fastify({ trustProxy: TrustProxy.parse(trustProxy) });
    app.get('/ip', async (req) => req.ip);
    const res = await app.inject({
      url: '/ip',
      remoteAddress: '172.18.0.5', // the reverse proxy's container address
      headers: { 'x-forwarded-for': xff },
    });
    await app.close();
    return res.body;
  }

  it('one trusted hop takes the entry the proxy appended, not a forged one', async () => {
    expect(await resolvedIp('1', '6.6.6.6, 203.0.113.7')).toBe('203.0.113.7');
  });

  it('with no proxy trusted, ignores X-Forwarded-For entirely', async () => {
    expect(await resolvedIp('false', '203.0.113.7')).toBe('172.18.0.5');
  });
});
