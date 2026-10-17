import type { Logger } from '@argus/logger';
import type { EventStore } from '../storage/index.js';

const HOUR_MS = 60 * 60_000;
const DAY_MS = 24 * HOUR_MS;

export interface RetentionDeps {
  eventStore: EventStore;
  retentionDays: number; // 0 = keep forever
  log: Logger;
  intervalMs?: number;
}

// The generator's background noise alone is tens of thousands of events a
// day, and nothing else ever deletes them — on a small shared VM the event
// store would eventually eat the disk. Hourly, drop everything older than the
// window. Alerts/incidents/summaries (Postgres) are kept: they're small and
// are the actual record; a trace for a pruned event just shows it as gone.
// Safe to run on several api instances at once — a delete is idempotent.
export async function pruneOnce({
  eventStore,
  retentionDays,
  log,
}: RetentionDeps): Promise<number> {
  const cutoff = new Date(Date.now() - retentionDays * DAY_MS);
  try {
    const deleted = await eventStore.prune(cutoff);
    if (deleted > 0) log.info({ deleted, cutoff, retentionDays }, 'pruned old events');
    return deleted;
  } catch (err) {
    log.error({ err }, 'event retention run failed');
    return 0;
  }
}

export function startRetention(deps: RetentionDeps): void {
  if (deps.retentionDays <= 0) {
    deps.log.info('EVENT_RETENTION_DAYS=0 — events are kept forever');
    return;
  }
  void pruneOnce(deps);
  // unref: a pending timer alone shouldn't keep the process alive on shutdown
  setInterval(() => void pruneOnce(deps), deps.intervalMs ?? HOUR_MS).unref();
  deps.log.info({ retentionDays: deps.retentionDays }, 'event retention started');
}
