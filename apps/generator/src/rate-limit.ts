// Token bucket, keyed per client. Kept local to this app rather than shared
// with apps/api — same reasoning as the generator owning its own tiny Kafka
// producer (§2): apps are conceptually separate services.

const SWEEP_INTERVAL_MS = 60_000;

export class RateLimiter {
  private readonly buckets = new Map<string, { tokens: number; lastRefill: number }>();
  private lastSweep = 0;

  constructor(
    private readonly capacity: number,
    private readonly refillPerSecond: number,
  ) {}

  get size(): number {
    return this.buckets.size;
  }

  tryConsume(key: string, now: number = Date.now()): boolean {
    this.sweep(now);

    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { tokens: this.capacity, lastRefill: now };
      this.buckets.set(key, bucket);
    }

    const elapsedSeconds = (now - bucket.lastRefill) / 1000;
    bucket.tokens = Math.min(this.capacity, bucket.tokens + elapsedSeconds * this.refillPerSecond);
    bucket.lastRefill = now;

    if (bucket.tokens < 1) return false;
    bucket.tokens -= 1;
    return true;
  }

  // a bucket idle long enough to have fully refilled is indistinguishable from
  // a fresh one, so dropping it is lossless — keeps the map from growing with
  // every distinct IP that ever hit a public deployment.
  private sweep(now: number): void {
    if (now - this.lastSweep < SWEEP_INTERVAL_MS) return;
    this.lastSweep = now;
    const fullAfterMs = (this.capacity / this.refillPerSecond) * 1000;
    for (const [key, bucket] of this.buckets) {
      if (now - bucket.lastRefill >= fullAfterMs) this.buckets.delete(key);
    }
  }
}
