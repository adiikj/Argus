'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Alert, Severity } from '@argus/contracts';
import { Wordmark } from '../_components/wordmark';

// Next inlines NEXT_PUBLIC_* at build time; falls back to the local api port.
const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:4100/ws';
// same host/port as the WS, over http — for /metrics polling.
const API_URL = WS_URL.replace(/^ws(s?):\/\//, 'http$1://').replace(/\/ws$/, '');

interface AlertMessage {
  type: 'alert.created';
  alert: Alert;
}

interface Metrics {
  uptimeSeconds: number;
  rawLogsConsumed: number;
  eventsNormalized: number;
  parseFailures: number;
  eventsIndexed: number;
  alertsRaised: number;
}

const SEVERITY_ORDER: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];

const SEVERITY_BADGE: Record<Severity, string> = {
  critical: 'bg-severity-critical/15 text-severity-critical border-severity-critical/30',
  high: 'bg-severity-high/15 text-severity-high border-severity-high/30',
  medium: 'bg-severity-medium/15 text-severity-medium border-severity-medium/30',
  low: 'bg-severity-low/15 text-severity-low border-severity-low/30',
  info: 'bg-severity-info/15 text-severity-info border-severity-info/30',
};

const SEVERITY_DOT: Record<Severity, string> = {
  critical: 'bg-severity-critical',
  high: 'bg-severity-high',
  medium: 'bg-severity-medium',
  low: 'bg-severity-low',
  info: 'bg-severity-info',
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour12: false });
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function Console() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [connected, setConnected] = useState(false);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [filter, setFilter] = useState<Severity | 'all'>('all');

  useEffect(() => {
    const socket = new WebSocket(WS_URL);
    socket.addEventListener('open', () => setConnected(true));
    socket.addEventListener('close', () => setConnected(false));
    socket.addEventListener('message', (event) => {
      const payload = JSON.parse(event.data as string) as AlertMessage;
      if (payload.type === 'alert.created') {
        setAlerts((prev) => [payload.alert, ...prev].slice(0, 200));
      }
    });
    return () => socket.close();
  }, []);

  // poll the pipeline counters (architecture §10); degrade quietly if offline
  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const res = await fetch(`${API_URL}/metrics`, { cache: 'no-store' });
        const data = (await res.json()) as Metrics;
        if (alive) setMetrics(data);
      } catch {
        if (alive) setMetrics(null);
      }
    };
    poll();
    const id = setInterval(poll, 3000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const severityCounts = useMemo(() => {
    const counts: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    for (const alert of alerts) counts[alert.severity] += 1;
    return counts;
  }, [alerts]);

  const visible = filter === 'all' ? alerts : alerts.filter((a) => a.severity === filter);

  return (
    <div className="min-h-screen bg-bg-base">
      <header className="sticky top-0 z-10 border-b border-border-subtle bg-bg-panel/80 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Wordmark />
            <span className="text-sm text-text-secondary">live alert feed</span>
          </div>
          <div className="flex items-center gap-2 font-mono text-xs text-text-secondary">
            <span
              className={`h-2 w-2 rounded-full ${
                connected ? 'animate-pulse bg-severity-ok' : 'bg-severity-info'
              }`}
            />
            {connected ? 'connected' : 'disconnected'}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        {/* pipeline metrics */}
        <div className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border-subtle bg-border-subtle sm:grid-cols-4">
          <Metric
            label="events"
            value={metrics ? metrics.eventsNormalized.toLocaleString() : '—'}
          />
          <Metric label="indexed" value={metrics ? metrics.eventsIndexed.toLocaleString() : '—'} />
          <Metric
            label="alerts"
            value={metrics ? metrics.alertsRaised.toLocaleString() : '—'}
            accent
          />
          <Metric
            label="parse fails"
            value={metrics ? metrics.parseFailures.toLocaleString() : '—'}
            danger={!!metrics && metrics.parseFailures > 0}
          />
        </div>

        {/* severity filter + counts */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <FilterChip
            label="all"
            count={alerts.length}
            active={filter === 'all'}
            onClick={() => setFilter('all')}
          />
          {SEVERITY_ORDER.map((sev) => (
            <FilterChip
              key={sev}
              label={sev}
              count={severityCounts[sev]}
              dot={SEVERITY_DOT[sev]}
              active={filter === sev}
              onClick={() => setFilter(filter === sev ? 'all' : sev)}
            />
          ))}
          {metrics && (
            <span className="ml-auto font-mono text-xs text-text-secondary">
              uptime {formatUptime(metrics.uptimeSeconds)}
            </span>
          )}
        </div>

        {visible.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border-subtle py-24 text-center">
            <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
            <p className="text-sm text-text-secondary">
              {alerts.length === 0 ? 'Waiting for detections…' : `No ${filter} alerts in view.`}
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {visible.map((alert) => (
              <li
                key={alert.alertId}
                className="animate-alert-in flex items-center gap-4 rounded-lg border border-border-subtle bg-bg-panel px-4 py-3"
              >
                <span
                  className={`shrink-0 rounded border px-2 py-0.5 font-mono text-[11px] font-semibold uppercase ${SEVERITY_BADGE[alert.severity]}`}
                >
                  {alert.severity}
                </span>
                <span className="hidden shrink-0 rounded bg-bg-elevated px-2 py-0.5 font-mono text-[11px] text-text-secondary sm:inline">
                  {alert.ruleId}
                </span>
                <span className="shrink-0 font-mono text-sm text-text-secondary">
                  {alert.entity}
                </span>
                <span className="flex-1 truncate text-sm text-text-primary">{alert.message}</span>
                {alert.count !== undefined && (
                  <span className="shrink-0 font-mono text-xs text-text-secondary">
                    ×{alert.count}
                  </span>
                )}
                <span className="shrink-0 font-mono text-xs text-text-secondary tabular-nums">
                  {formatTime(alert.timestamp)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

function Metric({
  label,
  value,
  accent,
  danger,
}: {
  label: string;
  value: string;
  accent?: boolean;
  danger?: boolean;
}) {
  const color = danger ? 'text-severity-critical' : accent ? 'text-accent' : 'text-text-primary';
  return (
    <div className="bg-bg-panel px-4 py-3">
      <div className={`font-mono text-xl font-semibold tabular-nums ${color}`}>{value}</div>
      <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-text-secondary">
        {label}
      </div>
    </div>
  );
}

function FilterChip({
  label,
  count,
  dot,
  active,
  onClick,
}: {
  label: string;
  count: number;
  dot?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-xs transition-colors ${
        active
          ? 'border-accent/40 bg-accent/10 text-text-primary'
          : 'border-border-subtle bg-bg-panel text-text-secondary hover:border-text-secondary'
      }`}
    >
      {dot && <span className={`h-2 w-2 rounded-full ${dot}`} />}
      {label}
      <span className="text-text-secondary">{count}</span>
    </button>
  );
}
