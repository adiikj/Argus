import { describe, expect, it } from 'vitest';
import { TrustProxy } from '../src/index.js';

describe('TRUST_PROXY', () => {
  it('defaults to no proxy', () => {
    expect(TrustProxy.parse(undefined)).toBe(false);
    expect(TrustProxy.parse('false')).toBe(false);
    expect(TrustProxy.parse('  ')).toBe(false);
  });

  it('parses a comma list of proxy addresses / named ranges', () => {
    expect(TrustProxy.parse('loopback, uniquelocal')).toEqual(['loopback', 'uniquelocal']);
    expect(TrustProxy.parse('127.0.0.1,172.16.0.0/12')).toEqual(['127.0.0.1', '172.16.0.0/12']);
  });

  it("rejects 'true' (would trust client-forged X-Forwarded-For)", () => {
    expect(TrustProxy.safeParse('true').success).toBe(false);
  });

  it('rejects a hop count (cannot verify the peer; Fastify >=5.12 ignores it)', () => {
    expect(TrustProxy.safeParse('1').success).toBe(false);
    expect(TrustProxy.safeParse('0').success).toBe(false);
  });
});
