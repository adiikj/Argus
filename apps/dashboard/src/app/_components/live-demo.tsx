'use client';

import { useEffect, useState } from 'react';
import type { Severity } from '@argus/contracts';

// A scripted, backend-free reproduction of the console's alert feed — purely
// for the landing page. Real data comes from the WebSocket on /console.
interface DemoAlert {
  id: number;
  severity: Severity;
  entity: string;
  message: string;
  count?: number;
  time: string;
}

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

type ScriptedAlert = Omit<DemoAlert, 'id' | 'time'>;

// A loop that tells a small story: recon → brute force → breach → cleanup.
const SCRIPT: ScriptedAlert[] = [
  { severity: 'info', entity: '10.0.4.12', message: 'New source IP observed on ssh' },
  {
    severity: 'low',
    entity: 'sshd/prod-web-01',
    message: 'Failed password for invalid user admin',
    count: 8,
  },
  {
    severity: 'medium',
    entity: 'sshd/prod-web-01',
    message: 'Repeated auth failures from single host',
    count: 34,
  },
  {
    severity: 'high',
    entity: '10.0.4.12',
    message: 'Brute-force SSH: threshold exceeded',
    count: 61,
  },
  {
    severity: 'critical',
    entity: 'root@prod-web-01',
    message: 'Successful login after brute-force burst',
  },
  { severity: 'high', entity: 'prod-web-01', message: 'Privilege escalation to root detected' },
  {
    severity: 'medium',
    entity: 'prod-web-01',
    message: 'Outbound connection to unknown host :4444',
  },
  { severity: 'info', entity: 'auth/us-east', message: 'MFA challenge issued' },
  { severity: 'low', entity: 'api-gateway', message: 'Rate limit tripped on /login' },
  { severity: 'high', entity: 'svc-billing', message: 'Access token used from new geography' },
];

function now(offsetSeconds: number): string {
  const d = new Date(Date.now() - offsetSeconds * 1000);
  return d.toLocaleTimeString(undefined, { hour12: false });
}

const VISIBLE = 8;

export function LiveDemo() {
  const [alerts, setAlerts] = useState<DemoAlert[]>([]);
  const [metrics, setMetrics] = useState({ events: 128_450, alerts: 41, incidents: 3 });

  useEffect(() => {
    // seed with a few so the panel is never empty
    let cursor = 0;
    const seed: DemoAlert[] = [5, 4, 3, 2, 1].map((offset, i) => {
      const s = SCRIPT[i % SCRIPT.length]!;
      cursor = i + 1;
      return { ...s, id: i, time: now(offset) };
    });
    setAlerts(seed);

    let id = seed.length;
    const feed = setInterval(() => {
      const s = SCRIPT[cursor % SCRIPT.length]!;
      cursor += 1;
      const next: DemoAlert = { ...s, id: id++, time: now(0) };
      setAlerts((prev) => [next, ...prev].slice(0, VISIBLE));
      setMetrics((m) => ({
        events: m.events + Math.floor(40 + Math.random() * 120),
        alerts: m.alerts + 1,
        incidents: s.severity === 'critical' ? m.incidents + 1 : m.incidents,
      }));
    }, 1900);

    // events counter ticks faster than the feed, so it always feels alive
    const ticker = setInterval(() => {
      setMetrics((m) => ({ ...m, events: m.events + Math.floor(3 + Math.random() * 20) }));
    }, 450);

    return () => {
      clearInterval(feed);
      clearInterval(ticker);
    };
  }, []);

  return (
    <div className="group relative">
      {/* glow */}
      <div
        aria-hidden
        className="animate-glow absolute -inset-6 -z-10 rounded-[2rem] bg-[radial-gradient(60%_60%_at_50%_0%,var(--color-accent),transparent_70%)] opacity-40 blur-2xl"
      />

      <div className="relative overflow-hidden rounded-2xl border border-border-subtle bg-bg-panel shadow-2xl shadow-black/60 ring-1 ring-white/5">
        {/* window chrome */}
        <div className="flex items-center justify-between border-b border-border-subtle bg-bg-elevated px-5 py-3.5">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-severity-critical/70" />
            <span className="h-3 w-3 rounded-full bg-severity-medium/70" />
            <span className="h-3 w-3 rounded-full bg-severity-ok/70" />
            <span className="ml-3 font-mono text-xs text-text-secondary">argus://console/live</span>
          </div>
          <div className="flex items-center gap-2 font-mono text-xs text-severity-ok">
            <span className="animate-blink h-2 w-2 rounded-full bg-severity-ok" />
            LIVE
          </div>
        </div>

        {/* live metrics strip */}
        <div className="grid grid-cols-3 divide-x divide-border-subtle border-b border-border-subtle bg-bg-base/40">
          <Metric label="events ingested" value={metrics.events.toLocaleString()} />
          <Metric label="alerts fired" value={String(metrics.alerts)} accent />
          <Metric label="open incidents" value={String(metrics.incidents)} danger />
        </div>

        {/* feed */}
        <div className="relative">
          {/* scan line — a thin sweep */}
          <div
            aria-hidden
            className="animate-scan pointer-events-none absolute inset-x-0 top-0 z-10 h-px bg-[linear-gradient(90deg,transparent,var(--color-accent),transparent)] opacity-30"
          />
          <ul className="flex min-h-[420px] flex-col gap-2 p-5">
            {alerts.map((alert) => (
              <li
                key={alert.id}
                className="animate-alert-in flex items-center gap-4 rounded-lg border border-border-subtle bg-bg-base px-4 py-3.5 transition-colors hover:border-accent/30 hover:bg-bg-elevated"
              >
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${SEVERITY_DOT[alert.severity]}`}
                  aria-hidden
                />
                <span
                  className={`shrink-0 rounded border px-2.5 py-1 font-mono text-[11px] font-semibold uppercase ${SEVERITY_BADGE[alert.severity]}`}
                >
                  {alert.severity}
                </span>
                <span className="hidden shrink-0 font-mono text-xs text-text-secondary sm:inline">
                  {alert.entity}
                </span>
                <span className="flex-1 truncate text-sm text-text-primary">{alert.message}</span>
                {alert.count !== undefined && (
                  <span className="shrink-0 rounded bg-bg-elevated px-2 py-0.5 font-mono text-xs text-text-secondary">
                    ×{alert.count}
                  </span>
                )}
                <span className="shrink-0 font-mono text-xs text-text-secondary tabular-nums">
                  {alert.time}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
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
    <div className="px-5 py-4">
      <div className={`font-mono text-2xl font-semibold tabular-nums ${color}`}>{value}</div>
      <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-text-secondary">
        {label}
      </div>
    </div>
  );
}
