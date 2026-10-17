import { describe, expect, it, vi } from 'vitest';
import { createLogger } from '@argus/logger';
import { pruneOnce } from '../../src/retention/index.js';
import type { EventStore } from '../../src/storage/index.js';

const log = createLogger({ name: 'test', level: 'fatal' });

function storeWith(prune: EventStore['prune']): EventStore {
  return {
    backend: 'postgres',
    ensure: async () => {},
    index: async () => {},
    getById: async () => undefined,
    search: async () => [],
    prune,
    checkHealth: async () => ({ ok: true, status: 'ok' }),
  };
}

describe('pruneOnce', () => {
  it('prunes everything older than the retention window', async () => {
    const prune = vi.fn(async () => 42);
    const before = Date.now();
    const deleted = await pruneOnce({ eventStore: storeWith(prune), retentionDays: 7, log });

    expect(deleted).toBe(42);
    const cutoff = (prune.mock.calls[0] as unknown as [Date])[0].getTime();
    const sevenDays = 7 * 24 * 60 * 60_000;
    expect(cutoff).toBeGreaterThanOrEqual(before - sevenDays);
    expect(cutoff).toBeLessThanOrEqual(Date.now() - sevenDays);
  });

  it('survives a failing store (logs, returns 0) so the timer keeps running', async () => {
    const prune = vi.fn(async () => {
      throw new Error('db down');
    });
    expect(await pruneOnce({ eventStore: storeWith(prune), retentionDays: 1, log })).toBe(0);
  });
});
