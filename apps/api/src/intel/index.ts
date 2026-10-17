import type { Logger } from '@argus/logger';
import type { IpReputation } from '@argus/contracts';
import type { PrismaClient } from '../incident/index.js';
import { classifyIp } from '../geo/index.js';
import { checkAbuseIpdb, type CheckResult } from './abuseipdb.js';

const TTL_MS = 24 * 60 * 60_000; // a reputation is good for a day
const DAILY_BUDGET = 900; // AbuseIPDB's free tier allows 1,000 checks/day — keep headroom

export interface ThreatIntel {
  readonly enabled: boolean;
  // cache first, then (budget permitting) the provider. Never throws; undefined
  // = not public, disabled, over budget, or the provider failed.
  lookup(ip: string): Promise<IpReputation | undefined>;
  // cache only — for read paths (incident detail) that must not spend quota
  cached(ip: string): Promise<IpReputation | undefined>;
}

export interface ThreatIntelDeps {
  prisma: PrismaClient;
  apiKey: string | undefined;
  log: Logger;
  check?: (ip: string) => Promise<CheckResult>; // tests inject a fake provider
  now?: () => Date;
}

type Row = Awaited<ReturnType<PrismaClient['ipReputation']['findUnique']>>;

function fromRow(row: NonNullable<Row>): IpReputation {
  return {
    ip: row.ip,
    provider: 'abuseipdb',
    abuseScore: row.abuseScore,
    totalReports: row.totalReports,
    distinctReporters: row.distinctReporters,
    isTor: row.isTor,
    usageType: row.usageType,
    isp: row.isp,
    domain: row.domain,
    countryCode: row.countryCode,
    lastReportedAt: row.lastReportedAt?.toISOString() ?? null,
    checkedAt: row.checkedAt.toISOString(),
  };
}

// Source-IP reputation from AbuseIPDB, for incidents from real addresses.
// Only public IPs are ever sent out — the demo's documentation-range attackers
// and internal addresses never leave the box. Results are cached in Postgres
// for a day; spending is capped below the free tier's daily limit and paused
// until the provider's reset time on a 429. Optional, like every external
// integration here: no ABUSEIPDB_API_KEY, no lookups.
export function createThreatIntel(deps: ThreatIntelDeps): ThreatIntel {
  const now = deps.now ?? (() => new Date());
  const apiKey = deps.apiKey;
  const check = deps.check ?? (apiKey ? (ip: string) => checkAbuseIpdb(apiKey, ip) : undefined);
  const inFlight = new Map<string, Promise<IpReputation | undefined>>();
  let budgetDay = '';
  let spent = 0;
  let pausedUntil = 0;

  async function cached(ip: string): Promise<IpReputation | undefined> {
    if (classifyIp(ip) !== 'public') return undefined;
    const row = await deps.prisma.ipReputation.findUnique({ where: { ip } });
    return row ? fromRow(row) : undefined;
  }

  function takeBudget(): boolean {
    const today = now().toISOString().slice(0, 10); // provider quota resets daily (UTC)
    if (today !== budgetDay) {
      budgetDay = today;
      spent = 0;
    }
    if (now().getTime() < pausedUntil || spent >= DAILY_BUDGET) return false;
    spent += 1;
    return true;
  }

  async function fetchAndStore(ip: string): Promise<IpReputation | undefined> {
    const hit = await cached(ip);
    if (hit && now().getTime() - new Date(hit.checkedAt).getTime() < TTL_MS) return hit;
    if (!check || !takeBudget()) return hit; // stale beats nothing

    const result = await check(ip);
    if (!result.ok) {
      if (result.reason === 'rate-limited') {
        pausedUntil = result.retryAt;
        deps.log.warn(
          { until: new Date(result.retryAt).toISOString() },
          'AbuseIPDB quota hit — pausing lookups',
        );
      } else {
        deps.log.warn({ ip, detail: result.detail }, 'AbuseIPDB lookup failed');
      }
      return hit;
    }

    const r = result.reputation;
    const data = {
      provider: r.provider,
      abuseScore: r.abuseScore,
      totalReports: r.totalReports,
      distinctReporters: r.distinctReporters,
      isTor: r.isTor,
      usageType: r.usageType,
      isp: r.isp,
      domain: r.domain,
      countryCode: r.countryCode,
      lastReportedAt: r.lastReportedAt ? new Date(r.lastReportedAt) : null,
      checkedAt: new Date(r.checkedAt),
    };
    await deps.prisma.ipReputation.upsert({ where: { ip }, create: { ip, ...data }, update: data });
    deps.log.info(
      { ip, abuseScore: r.abuseScore, totalReports: r.totalReports },
      'IP reputation checked',
    );
    return r;
  }

  return {
    enabled: Boolean(check),
    cached: (ip) => cached(ip).catch(() => undefined),
    lookup(ip) {
      if (classifyIp(ip) !== 'public') return Promise.resolve(undefined);
      // concurrent asks for the same IP (an incident and its quick updates)
      // share one provider call
      let pending = inFlight.get(ip);
      if (!pending) {
        pending = fetchAndStore(ip)
          .catch((err: unknown) => {
            deps.log.error({ err, ip }, 'threat intel lookup failed');
            return undefined;
          })
          .finally(() => inFlight.delete(ip));
        inFlight.set(ip, pending);
      }
      return pending;
    },
  };
}
