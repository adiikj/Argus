import type { RedisClientType } from 'redis';

export interface BaselineSample {
  count: number;
  zScore: number;
}

// per-entity rolling baseline for anomaly-scoring rules: buckets occurrences
// into fixed windows and scores the current (in-progress) bucket's count
// against the mean/stddev of the trailing `historyBuckets`, zero-padding any
// missing history — an entity with no track record reads as "baseline zero,"
// so a sudden burst from a brand-new entity scores as maximally anomalous
// rather than waiting through several idle buckets to build up real history.
export interface BaselineStore {
  observe(
    key: string,
    bucketMs: number,
    historyBuckets: number,
    now?: number,
  ): Promise<BaselineSample>;
}

interface Bucket {
  bucketStart: number;
  count: number;
}

// shared by both backends: score `count` against the mean/stddev of `history`
// (already zero-padded to `historyBuckets` by the caller).
function score(count: number, history: number[]): BaselineSample {
  const mean = history.reduce((a, b) => a + b, 0) / history.length;
  const variance = history.reduce((a, b) => a + (b - mean) ** 2, 0) / history.length;
  const stddev = Math.sqrt(variance);
  const zScore =
    stddev === 0 ? (count > mean ? Number.POSITIVE_INFINITY : 0) : (count - mean) / stddev;
  return { count, zScore };
}

function padHistory(history: number[], historyBuckets: number): number[] {
  return [...history, ...Array<number>(historyBuckets - history.length).fill(0)];
}

const SWEEP_INTERVAL_MS = 60_000;

export class InMemoryBaselineStore implements BaselineStore {
  private readonly series = new Map<string, { buckets: Bucket[]; spanMs: number }>();
  private lastSweep = 0;

  async observe(
    key: string,
    bucketMs: number,
    historyBuckets: number,
    now: number = Date.now(),
  ): Promise<BaselineSample> {
    this.sweep(now);
    const bucketStart = Math.floor(now / bucketMs) * bucketMs;
    // history is by *time*, like the Redis backend: only buckets inside the
    // trailing historyBuckets window count — an entity last seen 10 minutes
    // ago isn't judged against those stale buckets as if they were recent
    const oldestKept = bucketStart - historyBuckets * bucketMs;
    const buckets = (this.series.get(key)?.buckets ?? []).filter(
      (b) => b.bucketStart >= oldestKept,
    );

    let current = buckets[buckets.length - 1];
    if (!current || current.bucketStart !== bucketStart) {
      current = { bucketStart, count: 0 };
      buckets.push(current);
    }
    current.count += 1;
    this.series.set(key, { buckets, spanMs: (historyBuckets + 1) * bucketMs });

    const history = buckets.slice(0, -1).map((b) => b.count);
    return score(current.count, padHistory(history, historyBuckets));
  }

  // the in-memory twin of the Redis backend's key TTL
  private sweep(now: number): void {
    if (now - this.lastSweep < SWEEP_INTERVAL_MS) return;
    this.lastSweep = now;
    for (const [key, { buckets, spanMs }] of this.series) {
      const newest = buckets.at(-1)?.bucketStart ?? 0;
      if (newest <= now - spanMs) this.series.delete(key);
    }
  }
}

// Redis-backed: a hash per key, field = bucket start ms, value = that
// bucket's running count. HINCRBY records + reads back the current bucket's
// count in one round trip; stale fields (older than the history window) are
// dropped each call so the hash never grows past `historyBuckets + 1`
// fields. Same shape as RedisWindowStore's sorted set, just keyed by bucket
// start instead of per-event timestamps since we only need counts, not the
// individual events.
export class RedisBaselineStore implements BaselineStore {
  constructor(
    private readonly client: RedisClientType,
    private readonly keyPrefix = 'argus:baseline:',
  ) {}

  async observe(
    key: string,
    bucketMs: number,
    historyBuckets: number,
    now: number = Date.now(),
  ): Promise<BaselineSample> {
    const redisKey = `${this.keyPrefix}${key}`;
    const bucketStart = Math.floor(now / bucketMs) * bucketMs;
    const oldestKept = bucketStart - historyBuckets * bucketMs;

    const count = await this.client.hIncrBy(redisKey, String(bucketStart), 1);
    const all = await this.client.hGetAll(redisKey);

    const stale = Object.keys(all).filter((field) => Number(field) < oldestKept);
    if (stale.length > 0) await this.client.hDel(redisKey, stale);
    // idle keys expire on their own rather than living in Redis forever
    await this.client.expire(redisKey, Math.ceil(((historyBuckets + 1) * bucketMs) / 1000) + 5);

    const history = Object.entries(all)
      .filter(([field]) => Number(field) >= oldestKept && Number(field) < bucketStart)
      .map(([, value]) => Number(value));

    return score(count, padHistory(history, historyBuckets));
  }
}

// per-rule key namespace — see scopedWindowStore
export function scopedBaselineStore(store: BaselineStore, scope: string): BaselineStore {
  return {
    observe: (key, bucketMs, historyBuckets, now) =>
      store.observe(`${scope}:${key}`, bucketMs, historyBuckets, now),
  };
}
