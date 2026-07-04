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
// In-memory only for now — a Redis-backed version would follow the exact
// same ZADD/bucketed pattern WindowStore's Redis swap already established,
// not yet built since nothing here needs to survive more than one process.
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
    const padded = [...history, ...Array<number>(historyBuckets - history.length).fill(0)];

    const mean = padded.reduce((a, b) => a + b, 0) / padded.length;
    const variance = padded.reduce((a, b) => a + (b - mean) ** 2, 0) / padded.length;
    const stddev = Math.sqrt(variance);
    const zScore =
      stddev === 0
        ? current.count > mean
          ? Number.POSITIVE_INFINITY
          : 0
        : (current.count - mean) / stddev;

    return { count: current.count, zScore };
  }
}
