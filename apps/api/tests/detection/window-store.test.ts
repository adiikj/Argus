import { describe, it, expect } from 'vitest';
import { WindowStore, SeenEventIds } from '../../src/detection/window-store.js';

describe('WindowStore', () => {
  it('accumulates entries within the window', () => {
    const store = new WindowStore();
    store.record('ip', 'e1', 1000, 0);
    const entries = store.record('ip', 'e2', 1000, 500);
    expect(entries.map((e) => e.eventId)).toEqual(['e1', 'e2']);
  });

  it('evicts entries older than the window', () => {
    const store = new WindowStore();
    store.record('ip', 'old', 1000, 0);
    const entries = store.record('ip', 'new', 1000, 2000); // 'old' is now >1000ms back
    expect(entries.map((e) => e.eventId)).toEqual(['new']);
  });

  it('keeps windows independent per key', () => {
    const store = new WindowStore();
    store.record('a', 'a1', 1000, 0);
    const entries = store.record('b', 'b1', 1000, 0);
    expect(entries).toHaveLength(1);
  });
});

describe('SeenEventIds', () => {
  it('reports an id as seen only on subsequent checks', () => {
    const seen = new SeenEventIds(1000);
    expect(seen.hasSeen('e1', 0)).toBe(false);
    expect(seen.hasSeen('e1', 100)).toBe(true);
  });

  it('forgets ids once the TTL elapses', () => {
    const seen = new SeenEventIds(1000);
    seen.hasSeen('e1', 0);
    expect(seen.hasSeen('e1', 2000)).toBe(false); // evicted, treated as new
  });
});
