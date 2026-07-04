import type { RedisClientType } from 'redis';

export interface WindowEntry {
  eventId: string;
  at: number;
}

// sliding-window log for stateful rules, keyed by whatever the rule chooses
// (usually sourceIp). Keeps eventIds (not just a count) so a rule can cite
// every contributing event in its alert. `record` is async so the same
// interface covers both the in-memory and Redis-backed implementations below.
export interface WindowStore {
  // records this event under `key`, evicts entries older than windowMs, returns
  // every entry still in the window (oldest first, including the one just added).
  record(key: string, eventId: string, windowMs: number, now?: number): Promise<WindowEntry[]>;
}

export class InMemoryWindowStore implements WindowStore {
  private readonly occurrences = new Map<string, WindowEntry[]>();

  async record(
    key: string,
    eventId: string,
    windowMs: number,
    now: number = Date.now(),
  ): Promise<WindowEntry[]> {
    const cutoff = now - windowMs;
    const existing = this.occurrences.get(key) ?? [];
    const kept = existing.filter((entry) => entry.at > cutoff);
    kept.push({ eventId, at: now });
    this.occurrences.set(key, kept);
    return kept;
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
    eventId: string,
    windowMs: number,
    now: number = Date.now(),
  ): Promise<WindowEntry[]> {
    const redisKey = `${this.keyPrefix}${key}`;
    const cutoff = now - windowMs;

    await this.client.zAdd(redisKey, { score: now, value: eventId });
    await this.client.zRemRangeByScore(redisKey, '-inf', cutoff);
    // idle keys expire on their own rather than living in Redis forever
    await this.client.expire(redisKey, Math.ceil(windowMs / 1000) + 5);

    const members = await this.client.zRangeWithScores(redisKey, 0, -1);
    return members.map((m) => ({ eventId: m.value, at: m.score }));
  }
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
