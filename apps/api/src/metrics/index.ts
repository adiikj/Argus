// Lightweight in-process counters for the /metrics + /healthz endpoints
// (architecture §10). Not Prometheus — just enough to show the pipeline is
// moving: events processed, alerts raised, parse failures.
export interface MetricsSnapshot {
  uptimeSeconds: number;
  rawLogsConsumed: number;
  eventsNormalized: number;
  parseFailures: number;
  eventsIndexed: number;
  alertsRaised: number;
  incidentsOpened: number;
  incidentsUpdated: number;
}

type Counter = Exclude<keyof MetricsSnapshot, 'uptimeSeconds'>;

export interface Metrics {
  incr: (counter: Counter, by?: number) => void;
  snapshot: () => MetricsSnapshot;
}

export function createMetrics(): Metrics {
  const startedAt = Date.now();
  const counters: Record<Counter, number> = {
    rawLogsConsumed: 0,
    eventsNormalized: 0,
    parseFailures: 0,
    eventsIndexed: 0,
    alertsRaised: 0,
    incidentsOpened: 0,
    incidentsUpdated: 0,
  };

  return {
    incr: (counter, by = 1) => {
      counters[counter] += by;
    },
    snapshot: () => ({
      uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
      ...counters,
    }),
  };
}
