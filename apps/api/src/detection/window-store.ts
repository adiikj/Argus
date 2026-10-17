import type { RedisClientType } from 'redis';

export interface WindowEntry {
  eventId: string;
  at: number;
}

// sliding-window log for stateful rules, keyed by whatever the rule chooses
// (usually sourceIp). Keeps eventIds (not just a count) so a rule can cite
// every contributing event in its alert. Async so the same interface covers
// both the in-memory and Redis-backed implementations below.
//
// Members are a set, like a Redis sorted set: recording a member that's
// already in the window refreshes its timestamp instead of adding a second
// entry. Rules record eventIds (always unique) to count events, or a value
// like a username to count *distinct* values in the window.
export interface WindowStore {
  // records `member` under `key`, evicts entries older than windowMs, returns
  // every entry still in the window (oldest first, including the one just added).
  record(key: string, member: string, windowMs: number, now?: number): Promise<WindowEntry[]>;
  // same view as record() returns, without adding anything
  peek(key: string, windowMs: number, now?: number): Promise<WindowEntry[]>;
}

const SWEEP_INTERVAL_MS = 60_000;

export class InMemoryWindowStore implements WindowStore {
  private readonly windows = new Map<string, { entries: WindowEntry[]; windowMs: number }>();
  private lastSweep = 0;

  async record(
    key: string,
    member: string,
    windowMs: number,
    now: number = Date.now(),
  ): Promise<WindowEntry[]> {
    this.sweep(now);
    const kept = this.live(key, windowMs, now).filter((entry) => entry.eventId !== member);
    kept.push({ eventId: member, at: now });
    this.windows.set(key, { entries: kept, windowMs });
    return kept;
  }

  async peek(key: string, windowMs: number, now: number = Date.now()): Promise<WindowEntry[]> {
    return this.live(key, windowMs, now);
  }

  private live(key: string, windowMs: number, now: number): WindowEntry[] {
    const cutoff = now - windowMs;
    return (this.windows.get(key)?.entries ?? []).filter((entry) => entry.at > cutoff);
  }

  // the in-memory twin of the Redis backend's key TTL: drop keys whose newest
  // entry has aged out of their window, so memory doesn't grow with every
  // source IP that was ever seen
  private sweep(now: number): void {
    if (now - this.lastSweep < SWEEP_INTERVAL_MS) return;
    this.lastSweep = now;
    for (const [key, { entries, windowMs }] of this.windows) {
      const newest = entries.at(-1)?.at ?? 0;
      if (newest <= now - windowMs) this.windows.delete(key);
    }
  }
}

// Redis-backed: a sorted set per key, score = timestamp ms, member = eventId.
// ZADD records, ZREMRANGEBYSCORE evicts everything at or before the cutoff,
// ZRANGE reads back what's left — the same three steps InMemoryWindowStore
// does by hand, persisted and shared across every process that shares REDIS_URL.
export class RedisWindowStore implements WindowStore {
  constructor(
    private readonly client: RedisClientType,
    private readonly keyPrefix = 'argus:window:',
  ) {}

  async record(
    key: string,
    member: string,
    windowMs: number,
    now: number = Date.now(),
  ): Promise<WindowEntry[]> {
    const redisKey = `${this.keyPrefix}${key}`;
    await this.client.zAdd(redisKey, { score: now, value: member });
    // idle keys expire on their own rather than living in Redis forever
    await this.client.expire(redisKey, Math.ceil(windowMs / 1000) + 5);
    return this.peek(key, windowMs, now);
  }

  async peek(key: string, windowMs: number, now: number = Date.now()): Promise<WindowEntry[]> {
    const redisKey = `${this.keyPrefix}${key}`;
    await this.client.zRemRangeByScore(redisKey, '-inf', now - windowMs);
    const members = await this.client.zRangeWithScores(redisKey, 0, -1);
    return members.map((m) => ({ eventId: m.value, at: m.score }));
  }
}

// A view of `store` with every key prefixed — the engine hands each rule its
// own, so two rules that both key by source IP can't read each other's
// entries (brute-force-ssh and api-rate-abuse once shared one window per IP:
// 40 API calls + 1 failed SSH login read as "41 failed SSH logins").
export function scopedWindowStore(store: WindowStore, scope: string): WindowStore {
  return {
    record: (key, member, windowMs, now) => store.record(`${scope}:${key}`, member, windowMs, now),
    peek: (key, windowMs, now) => store.peek(`${scope}:${key}`, windowMs, now),
  };
}

// bounded TTL set of eventIds, so a redelivered (at-least-once) Kafka message
// can't double-count in a windowed rule. Kept in-memory even under REDIS_URL —
// it's a per-consumer redelivery guard, not shared detection state, so there's
// nothing to gain from making it distributed.
export class SeenEventIds {
  private readonly seenAt = new Map<string, number>();

  constructor(private readonly ttlMs: number) {}

  // returns true if this eventId was already seen within the TTL.
  hasSeen(eventId: string, now: number = Date.now()): boolean {
    this.evictExpired(now);
    const seen = this.seenAt.has(eventId);
    if (!seen) this.seenAt.set(eventId, now);
    return seen;
  }

  private evictExpired(now: number): void {
    for (const [eventId, seenAt] of this.seenAt) {
      if (now - seenAt > this.ttlMs) this.seenAt.delete(eventId);
    }
  }
}
