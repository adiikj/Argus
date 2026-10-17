import { describe, expect, it, vi } from 'vitest';
import { createLogger } from '@argus/logger';
import type { IpReputation } from '@argus/contracts';
import { checkAbuseIpdb, type CheckResult } from '../../src/intel/abuseipdb.js';
import { createThreatIntel } from '../../src/intel/index.js';
import type { PrismaClient } from '../../src/incident/index.js';

const log = createLogger({ level: 'fatal' });
const NOW = new Date('2026-10-17T12:00:00Z');

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { status: 200, ...init });

describe('checkAbuseIpdb', () => {
  it('maps a check response', async () => {
    const fetchImpl = vi.fn(async () =>
      json({
        data: {
          ipAddress: '8.8.8.8',
          abuseConfidenceScore: 87,
          totalReports: 412,
          numDistinctUsers: 96,
          isTor: false,
          usageType: 'Data Center/Web Hosting/Transit',
          isp: 'Example Hosting',
          domain: 'example.net',
          countryCode: 'NL',
          lastReportedAt: '2026-10-17T10:00:00+00:00',
        },
      }),
    );
    const result = await checkAbuseIpdb('k', '8.8.8.8', fetchImpl, () => NOW);
    expect(result).toEqual({
      ok: true,
      reputation: expect.objectContaining({
        ip: '8.8.8.8',
        abuseScore: 87,
        totalReports: 412,
        distinctReporters: 96,
        usageType: 'Data Center/Web Hosting/Transit',
        lastReportedAt: '2026-10-17T10:00:00.000Z',
        checkedAt: NOW.toISOString(),
      }),
    });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('ipAddress=8.8.8.8');
    expect((init.headers as Record<string, string>).Key).toBe('k');
  });

  it('reports a 429 with the provider reset time', async () => {
    const reset = Math.floor(NOW.getTime() / 1000) + 3600;
    const result = await checkAbuseIpdb(
      'k',
      '8.8.8.8',
      async () =>
        new Response('{}', { status: 429, headers: { 'x-ratelimit-reset': String(reset) } }),
      () => NOW,
    );
    expect(result).toEqual({ ok: false, reason: 'rate-limited', retryAt: reset * 1000 });
  });

  it('rejects a malformed response instead of trusting it', async () => {
    const result = await checkAbuseIpdb('k', '8.8.8.8', async () =>
      json({ data: { abuseConfidenceScore: 'lots' } }),
    );
    expect(result).toMatchObject({ ok: false, reason: 'error' });
  });

  it('turns a network failure into an error result', async () => {
    const result = await checkAbuseIpdb('k', '8.8.8.8', async () => {
      throw new TypeError('fetch failed');
    });
    expect(result).toMatchObject({ ok: false, reason: 'error' });
  });
});

// minimal in-memory stand-in for the two Prisma calls the service makes
function fakePrisma() {
  const rows = new Map<string, Record<string, unknown>>();
  return {
    rows,
    prisma: {
      ipReputation: {
        findUnique: async ({ where }: { where: { ip: string } }) => rows.get(where.ip) ?? null,
        upsert: async ({
          where,
          create,
        }: {
          where: { ip: string };
          create: Record<string, unknown>;
        }) => rows.set(where.ip, create),
      },
    } as unknown as PrismaClient,
  };
}

const rep = (ip: string, at = NOW): IpReputation => ({
  ip,
  provider: 'abuseipdb',
  abuseScore: 50,
  totalReports: 3,
  distinctReporters: 2,
  isTor: false,
  usageType: null,
  isp: null,
  domain: null,
  countryCode: null,
  lastReportedAt: null,
  checkedAt: at.toISOString(),
});

describe('threat intel service', () => {
  function setup(check: (ip: string) => Promise<CheckResult>, now = () => NOW) {
    const db = fakePrisma();
    const spy = vi.fn(check);
    const intel = createThreatIntel({ prisma: db.prisma, apiKey: 'k', log, check: spy, now });
    return { intel, spy, db };
  }
  const okCheck = async (ip: string): Promise<CheckResult> => ({ ok: true, reputation: rep(ip) });

  it('never sends demo (documentation-range) or internal IPs to the provider', async () => {
    const { intel, spy } = setup(okCheck);
    for (const ip of [
      '198.51.100.7',
      '203.0.113.1',
      '10.0.0.5',
      '192.168.1.1',
      '::1',
      'not-an-ip',
    ]) {
      expect(await intel.lookup(ip)).toBeUndefined();
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it('caches a result for a day', async () => {
    let now = NOW;
    const { intel, spy } = setup(okCheck, () => now);
    await intel.lookup('8.8.8.8');
    await intel.lookup('8.8.8.8');
    expect(spy).toHaveBeenCalledTimes(1);
    expect((await intel.cached('8.8.8.8'))?.abuseScore).toBe(50);

    now = new Date(NOW.getTime() + 25 * 60 * 60_000); // past the TTL
    await intel.lookup('8.8.8.8');
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('shares one provider call between concurrent lookups of the same IP', async () => {
    const { intel, spy } = setup(okCheck);
    await Promise.all([intel.lookup('1.1.1.1'), intel.lookup('1.1.1.1'), intel.lookup('1.1.1.1')]);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('stops calling the provider after a 429 until its reset time', async () => {
    let now = NOW;
    const retryAt = NOW.getTime() + 60 * 60_000;
    const { intel, spy } = setup(
      async () => ({ ok: false, reason: 'rate-limited', retryAt }),
      () => now,
    );
    await intel.lookup('8.8.8.8');
    await intel.lookup('8.8.4.4');
    expect(spy).toHaveBeenCalledTimes(1);
    now = new Date(retryAt + 1000);
    await intel.lookup('8.8.4.4');
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('caps itself below the free tier daily limit', async () => {
    const { intel, spy } = setup(okCheck);
    for (let i = 0; i < 950; i += 1)
      await intel.lookup(`8.8.${Math.floor(i / 250)}.${(i % 250) + 1}`);
    expect(spy).toHaveBeenCalledTimes(900);
  });

  it('is off without an API key', async () => {
    const intel = createThreatIntel({ prisma: fakePrisma().prisma, apiKey: undefined, log });
    expect(intel.enabled).toBe(false);
    expect(await intel.lookup('8.8.8.8')).toBeUndefined();
  });
});
