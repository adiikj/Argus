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

export class InMemoryBaselineStore implements BaselineStore {
  private readonly series = new Map<string, Bucket[]>();

  async observe(
    key: string,
    bucketMs: number,
    historyBuckets: number,
    now: number = Date.now(),
  ): Promise<BaselineSample> {
    const bucketStart = Math.floor(now / bucketMs) * bucketMs;
    const buckets = this.series.get(key) ?? [];

    let current = buckets[buckets.length - 1];
    if (!current || current.bucketStart !== bucketStart) {
      current = { bucketStart, count: 0 };
      buckets.push(current);
    }
    current.count += 1;

    // keep only the current bucket plus up to `historyBuckets` before it
    const trimmed = buckets.slice(-(historyBuckets + 1));
    this.series.set(key, trimmed);

    const history = trimmed.slice(0, -1).map((b) => b.count);
    return score(current.count, padHistory(history, historyBuckets));
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
