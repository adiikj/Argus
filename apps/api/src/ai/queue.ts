export interface SummaryQueueOptions {
  concurrency: number;
  debounceMs: number;
  run: (incidentId: string) => Promise<void>;
}

export interface SummaryQueue {
  schedule: (incidentId: string) => void;
}

export function createSummaryQueue(options: SummaryQueueOptions): SummaryQueue {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const pending: string[] = [];
  let active = 0;

  function drain(): void {
    while (active < options.concurrency && pending.length > 0) {
      const incidentId = pending.shift();
      if (!incidentId) continue;
      active += 1;
      options
        .run(incidentId)
        .catch(() => undefined)
        .finally(() => {
          active -= 1;
          drain();
        });
    }
  }

  return {
    schedule(incidentId) {
      const existing = timers.get(incidentId);
      if (existing) clearTimeout(existing);
      timers.set(
        incidentId,
        setTimeout(() => {
          timers.delete(incidentId);
          pending.push(incidentId);
          drain();
        }, options.debounceMs),
      );
    },
  };
}
