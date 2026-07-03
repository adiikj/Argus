'use client';

import { useEffect, useRef, useState } from 'react';
import type { Metrics } from './use-metrics';

export interface MetricsPoint {
  t: string;
  alerts: number;
  events: number;
}

const MAX_POINTS = 30;

export function useMetricsHistory(metrics: Metrics | undefined): MetricsPoint[] {
  const [history, setHistory] = useState<MetricsPoint[]>([]);
  const prevRef = useRef<Metrics | undefined>(undefined);

  useEffect(() => {
    if (!metrics) return;
    const prev = prevRef.current;
    prevRef.current = metrics;

    const point: MetricsPoint = {
      t: new Date().toLocaleTimeString(undefined, { hour12: false }),
      alerts: prev ? Math.max(0, metrics.alertsRaised - prev.alertsRaised) : 0,
      events: prev ? Math.max(0, metrics.eventsNormalized - prev.eventsNormalized) : 0,
    };

    setHistory((h) => [...h, point].slice(-MAX_POINTS));
  }, [metrics]);

  return history;
}
