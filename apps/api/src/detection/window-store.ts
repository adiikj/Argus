export interface WindowEntry {
  eventId: string;
  at: number;
}

// in-memory sliding-window log for stateful rules, keyed by whatever the rule
// chooses (usually sourceIp). Keeps eventIds (not just a count) so a rule can
// cite every contributing event in its alert. V2 swap = Redis (sorted sets
// keyed by timestamp, values = eventId); same interface.
export class WindowStore {
  private readonly occurrences = new Map<string, WindowEntry[]>();

  // records this event under `key`, evicts entries older than windowMs, returns
  // every entry still in the window (oldest first, including the one just added).
  record(key: string, eventId: string, windowMs: number, now: number = Date.now()): WindowEntry[] {
    const cutoff = now - windowMs;
    const existing = this.occurrences.get(key) ?? [];
    const kept = existing.filter((entry) => entry.at > cutoff);
    kept.push({ eventId, at: now });
    this.occurrences.set(key, kept);
    return kept;
  }
}

// bounded TTL set of eventIds, so a redelivered (at-least-once) Kafka message
// can't double-count in a windowed rule
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
