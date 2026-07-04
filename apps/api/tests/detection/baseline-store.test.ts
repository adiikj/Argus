import { describe, it, expect } from 'vitest';
import { InMemoryBaselineStore } from '../../src/detection/baseline-store.js';

const BUCKET_MS = 1000;

describe('InMemoryBaselineStore', () => {
  it('scores a first-ever burst as maximally anomalous against a zero baseline', async () => {
    const store = new InMemoryBaselineStore();
    const sample = await store.observe('fresh-ip', BUCKET_MS, 3, 0);
    expect(sample.count).toBe(1);
    expect(sample.zScore).toBe(Number.POSITIVE_INFINITY);
  });

  it('accumulates count within the same bucket', async () => {
    const store = new InMemoryBaselineStore();
    await store.observe('ip', BUCKET_MS, 3, 0);
    const sample = await store.observe('ip', BUCKET_MS, 3, 500); // still bucket 0
    expect(sample.count).toBe(2);
  });

  it('rotates to a new bucket and carries the prior one as history', async () => {
    const store = new InMemoryBaselineStore();
    await store.observe('ip', BUCKET_MS, 1, 0); // bucket 0: count -> 1
    await store.observe('ip', BUCKET_MS, 1, 100); // bucket 0: count -> 2
    const sample = await store.observe('ip', BUCKET_MS, 1, 1500); // bucket 1: count -> 1
    expect(sample.count).toBe(1); // new bucket starts fresh, not carried over
    // quieter than the prior bucket's count of 2 — not anomalous
    expect(sample.zScore).toBe(0);
  });

  it('flags a spike against a noisy (non-zero-variance) baseline', async () => {
    const store = new InMemoryBaselineStore();
    await store.observe('ip', BUCKET_MS, 3, 0); // bucket 0: count 1
    await store.observe('ip', BUCKET_MS, 3, 1000); // bucket 1: count 1
    await store.observe('ip', BUCKET_MS, 3, 1050); // bucket 1: count 2
    await store.observe('ip', BUCKET_MS, 3, 2000); // bucket 2: count 1
    await store.observe('ip', BUCKET_MS, 3, 2050); // bucket 2: count 2
    await store.observe('ip', BUCKET_MS, 3, 2100); // bucket 2: count 3
    // history so far: [1, 2, 3], mean 2, stddev ~0.8165
    let sample;
    for (let i = 0; i < 10; i += 1) {
      sample = await store.observe('ip', BUCKET_MS, 3, 3000 + i); // bucket 3: count -> 10
    }
    expect(sample!.count).toBe(10);
    expect(sample!.zScore).toBeGreaterThan(3);
  });

  it('keeps baselines independent per key', async () => {
    const store = new InMemoryBaselineStore();
    for (let i = 0; i < 5; i += 1) await store.observe('busy', BUCKET_MS, 3, i);
    const quiet = await store.observe('quiet', BUCKET_MS, 3, 0);
    expect(quiet.count).toBe(1);
  });
});
