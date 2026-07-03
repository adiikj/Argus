import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createSummaryQueue } from '../../src/ai/queue.js';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('createSummaryQueue', () => {
  it('debounces repeated schedules for the same incident into one run', async () => {
    const run = vi.fn().mockResolvedValue(undefined);
    const queue = createSummaryQueue({ concurrency: 1, debounceMs: 1000, run });

    queue.schedule('a');
    vi.advanceTimersByTime(500);
    queue.schedule('a');
    vi.advanceTimersByTime(500);
    queue.schedule('a');
    await vi.advanceTimersByTimeAsync(1000);

    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith('a');
  });

  it('keeps debounces independent per incident', async () => {
    const run = vi.fn().mockResolvedValue(undefined);
    const queue = createSummaryQueue({ concurrency: 2, debounceMs: 1000, run });

    queue.schedule('a');
    queue.schedule('b');
    await vi.advanceTimersByTimeAsync(1000);

    expect(run).toHaveBeenCalledTimes(2);
    expect(run).toHaveBeenCalledWith('a');
    expect(run).toHaveBeenCalledWith('b');
  });

  it('caps concurrency, running the rest once a slot frees up', async () => {
    const resolvers: Array<() => void> = [];
    const run = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolvers.push(resolve);
        }),
    );
    const queue = createSummaryQueue({ concurrency: 1, debounceMs: 0, run });

    queue.schedule('a');
    queue.schedule('b');
    await vi.advanceTimersByTimeAsync(0);
    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith('a');

    resolvers[0]?.();
    await vi.advanceTimersByTimeAsync(0);
    expect(run).toHaveBeenCalledTimes(2);
    expect(run).toHaveBeenCalledWith('b');
  });
});
