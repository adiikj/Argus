import { z } from 'zod';
import type { IpReputation } from '@argus/contracts';

const ENDPOINT = 'https://api.abuseipdb.com/api/v2/check';
const TIMEOUT_MS = 5000;
const MAX_AGE_DAYS = 90;

// the provider's response is untrusted input like any other — validated
// before anything from it reaches the database, the UI or an LLM prompt
const CheckResponse = z.object({
  data: z.object({
    ipAddress: z.string().max(64),
    abuseConfidenceScore: z.number().int().min(0).max(100),
    totalReports: z.number().int().nonnegative(),
    numDistinctUsers: z.number().int().nonnegative(),
    isTor: z.boolean().optional().default(false),
    usageType: z.string().max(200).nullish(),
    isp: z.string().max(200).nullish(),
    domain: z.string().max(200).nullish(),
    countryCode: z.string().max(8).nullish(),
    lastReportedAt: z.string().datetime({ offset: true }).nullish(),
  }),
});

export type CheckResult =
  | { ok: true; reputation: IpReputation }
  | { ok: false; reason: 'rate-limited'; retryAt: number }
  | { ok: false; reason: 'error'; detail: string };

export async function checkAbuseIpdb(
  apiKey: string,
  ip: string,
  fetchImpl: typeof fetch = fetch,
  now: () => Date = () => new Date(),
): Promise<CheckResult> {
  const url = `${ENDPOINT}?ipAddress=${encodeURIComponent(ip)}&maxAgeInDays=${MAX_AGE_DAYS}`;
  let res: Response;
  try {
    res = await fetchImpl(url, {
      headers: { Key: apiKey, Accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    return { ok: false, reason: 'error', detail: err instanceof Error ? err.name : 'fetch failed' };
  }

  if (res.status === 429) {
    // X-RateLimit-Reset is an epoch (seconds); fall back to Retry-After, then an hour
    const reset = Number(res.headers.get('x-ratelimit-reset')) * 1000;
    const retryAfter = Number(res.headers.get('retry-after')) * 1000;
    const retryAt = reset > 0 ? reset : now().getTime() + (retryAfter > 0 ? retryAfter : 3_600_000);
    return { ok: false, reason: 'rate-limited', retryAt };
  }
  if (!res.ok) return { ok: false, reason: 'error', detail: `http ${res.status}` };

  const parsed = CheckResponse.safeParse(await res.json().catch(() => undefined));
  if (!parsed.success) return { ok: false, reason: 'error', detail: 'unexpected response shape' };
  const d = parsed.data.data;
  return {
    ok: true,
    reputation: {
      ip,
      provider: 'abuseipdb',
      abuseScore: d.abuseConfidenceScore,
      totalReports: d.totalReports,
      distinctReporters: d.numDistinctUsers,
      isTor: d.isTor,
      usageType: d.usageType ?? null,
      isp: d.isp ?? null,
      domain: d.domain ?? null,
      countryCode: d.countryCode ?? null,
      lastReportedAt: d.lastReportedAt ? new Date(d.lastReportedAt).toISOString() : null,
      checkedAt: now().toISOString(),
    },
  };
}
