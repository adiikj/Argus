'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useEventTrace } from '@/lib/use-event-trace';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { hour12: false });
}

function Stage({
  title,
  reached,
  last,
  children,
}: {
  title: string;
  reached: boolean;
  last?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <span
          className={cn(
            'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs',
            reached
              ? 'border-accent bg-accent/10 text-accent'
              : 'border-border-subtle text-text-secondary',
          )}
        >
          {reached ? '✓' : '—'}
        </span>
        {!last && <span className="mt-1 w-px flex-1 bg-border-subtle" />}
      </div>
      <div className="flex-1 pb-8">
        <p
          className={cn(
            'font-mono text-xs uppercase tracking-wider',
            reached ? 'text-text-primary' : 'text-text-secondary',
          )}
        >
          {title}
        </p>
        <div className="mt-2">{children}</div>
      </div>
    </div>
  );
}

export function TraceClient({ eventId }: { eventId: string }) {
  const { data, isLoading } = useEventTrace(eventId);

  if (isLoading || !data) {
    return <div className="px-6 py-8 text-sm text-text-secondary">Tracing event…</div>;
  }

  const { event, alerts, incidents } = data;

  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      <Link
        href="/logs"
        className="mb-6 inline-flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        back to log explorer
      </Link>

      <p className="mb-1 font-mono text-xs text-text-secondary">{eventId}</p>
      <h1 className="mb-6 text-lg font-semibold text-text-primary">Pipeline trace</h1>

      <Stage title="Normalized" reached={!!event}>
        {event ? (
          <Card>
            <CardContent className="space-y-1 p-4 font-mono text-xs text-text-secondary">
              <p>
                <span className="text-text-primary">{event.source}</span> · {event.sourceIp} ·{' '}
                {event.outcome} · {formatDateTime(event.timestamp)}
              </p>
              <p className="truncate text-text-primary">{event.raw}</p>
            </CardContent>
          </Card>
        ) : (
          <p className="text-sm text-text-secondary">Not found in Elasticsearch yet.</p>
        )}
      </Stage>

      <Stage title="Detected" reached={alerts.length > 0}>
        {alerts.length > 0 ? (
          <div className="flex flex-col gap-2">
            {alerts.map((alert) => (
              <Card key={alert.alertId}>
                <CardContent className="flex items-center gap-3 p-3">
                  <Badge variant={alert.severity}>{alert.severity}</Badge>
                  <span className="rounded bg-bg-elevated px-2 py-0.5 font-mono text-[11px] text-text-secondary">
                    {alert.ruleId}
                  </span>
                  <span className="flex-1 truncate text-sm text-text-primary">{alert.message}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-secondary">No rule matched this event.</p>
        )}
      </Stage>

      <Stage title="Correlated" reached={incidents.length > 0} last>
        {incidents.length > 0 ? (
          <div className="flex flex-col gap-2">
            {incidents.map((incident) => (
              <Link key={incident.incidentId} href={`/incidents/${incident.incidentId}`}>
                <Card className="transition-colors hover:border-accent/40">
                  <CardContent className="flex items-center gap-3 p-3">
                    <Badge variant={incident.severity}>{incident.severity}</Badge>
                    <span className="flex-1 truncate font-mono text-sm text-text-primary">
                      {incident.correlationKey}
                    </span>
                    <span className="font-mono text-xs text-accent">view incident →</span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-secondary">Not part of an incident.</p>
        )}
      </Stage>
    </main>
  );
}
