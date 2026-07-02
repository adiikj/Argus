'use client';

import { useEffect, useState } from 'react';
import type { Alert, Severity } from '@argus/contracts';
import { Wordmark } from '../_components/wordmark';

const WS_URL = 'ws://localhost:4100/ws';

interface AlertMessage {
  type: 'alert.created';
  alert: Alert;
}

const SEVERITY_BADGE: Record<Severity, string> = {
  critical: 'bg-severity-critical/15 text-severity-critical border-severity-critical/30',
  high: 'bg-severity-high/15 text-severity-high border-severity-high/30',
  medium: 'bg-severity-medium/15 text-severity-medium border-severity-medium/30',
  low: 'bg-severity-low/15 text-severity-low border-severity-low/30',
  info: 'bg-severity-info/15 text-severity-info border-severity-info/30',
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour12: false });
}

export default function Console() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [connected, setConnected] = useState(false);

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

  return (
    <div className="min-h-screen bg-bg-base">
      <header className="sticky top-0 z-10 border-b border-border-subtle bg-bg-panel/80 backdrop-blur px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Wordmark />
            <span className="text-sm text-text-secondary">live alert feed</span>
          </div>
          <div className="flex items-center gap-2 font-mono text-xs text-text-secondary">
            <span
              className={`h-2 w-2 rounded-full ${
                connected ? 'bg-severity-ok animate-pulse' : 'bg-severity-info'
              }`}
            />
            {connected ? 'connected' : 'disconnected'}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border-subtle py-24 text-center">
            <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
            <p className="text-sm text-text-secondary">Waiting for detections…</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {alerts.map((alert) => (
              <li
                key={alert.alertId}
                className="animate-alert-in flex items-center gap-4 rounded-lg border border-border-subtle bg-bg-panel px-4 py-3"
              >
                <span
                  className={`shrink-0 rounded border px-2 py-0.5 font-mono text-[11px] font-semibold uppercase ${SEVERITY_BADGE[alert.severity]}`}
                >
                  {alert.severity}
                </span>
                <span className="shrink-0 font-mono text-sm text-text-secondary">
                  {alert.entity}
                </span>
                <span className="flex-1 text-sm text-text-primary">{alert.message}</span>
                {alert.count !== undefined && (
                  <span className="shrink-0 font-mono text-xs text-text-secondary">
                    ×{alert.count}
                  </span>
                )}
                <span className="shrink-0 font-mono text-xs text-text-secondary">
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
