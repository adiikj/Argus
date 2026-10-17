import { describe, expect, it } from 'vitest';
import { TrustProxy } from '../src/index.js';

describe('TRUST_PROXY', () => {
  it('defaults to no proxy', () => {
    expect(TrustProxy.parse(undefined)).toBe(false);
    expect(TrustProxy.parse('false')).toBe(false);
    expect(TrustProxy.parse('0')).toBe(false);
    expect(TrustProxy.parse('  ')).toBe(false);
  });

  it('parses a hop count', () => {
    expect(TrustProxy.parse('1')).toBe(1);
    expect(TrustProxy.parse(' 2 ')).toBe(2);
  });

  it('parses a comma list of proxy addresses', () => {
    expect(TrustProxy.parse('127.0.0.1, 172.16.0.0/12')).toEqual(['127.0.0.1', '172.16.0.0/12']);
  });

  it("rejects 'true' (would trust client-forged X-Forwarded-For)", () => {
    const result = TrustProxy.safeParse('true');
    expect(result.success).toBe(false);
  });
});
