'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useIncidentDetail } from '@/lib/use-incident-detail';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { hour12: false });
}

export function IncidentDetailClient({ id }: { id: string }) {
  const { data, isLoading, isError } = useIncidentDetail(id);

  if (isLoading) {
    return <div className="px-6 py-8 text-sm text-text-secondary">Loading incident…</div>;
  }

  if (isError || !data) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm text-text-secondary">
          Couldn&apos;t find that incident — it may have rolled out of view, or the api isn&apos;t
          reachable.
        </p>
        <Link href="/alerts" className="text-xs text-accent hover:underline">
          ← back to alerts
        </Link>
      </div>
    );
  }

  const { incident, alerts, summary } = data;

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <Link
        href="/alerts"
        className="mb-6 inline-flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        back to alerts
      </Link>

      <div className="mb-6">
        <div className="mb-2 flex items-center gap-2">
          <Badge variant={incident.severity}>{incident.severity}</Badge>
          <Badge variant="outline">{incident.status}</Badge>
        </div>
        <h1 className="font-mono text-lg font-semibold text-text-primary">
          {incident.correlationKey}
        </h1>
        <p className="mt-1 text-xs text-text-secondary">
          opened {formatDateTime(incident.createdAt)} · updated {formatDateTime(incident.updatedAt)}
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>AI summary</CardTitle>
        </CardHeader>
        <CardContent>
          {summary ? (
            <div className="space-y-4">
              <div className="flex items-start gap-2">
                <Badge className="mt-0.5 shrink-0">{summary.generatedBy}</Badge>
                <p className="text-sm leading-relaxed text-text-primary">{summary.summary}</p>
              </div>
              {summary.iocs.length > 0 && (
                <div>
                  <p className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-text-secondary">
                    Indicators
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {summary.iocs.map((ioc) => (
                      <span
                        key={ioc}
                        className="rounded bg-bg-elevated px-2 py-0.5 font-mono text-xs text-text-primary"
                      >
                        {ioc}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {summary.recommendedActions.length > 0 && (
                <div>
                  <p className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-text-secondary">
                    Recommended actions
                  </p>
                  <ul className="list-inside list-disc space-y-1 text-sm text-text-secondary">
                    {summary.recommendedActions.map((action) => (
                      <li key={action}>{action}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-text-secondary">
              No summary yet — one generates shortly after the incident settles.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Timeline · {alerts.length} alert{alerts.length === 1 ? '' : 's'}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ul>
            {alerts.map((alert, i) => (
              <li key={alert.alertId}>
                {i > 0 && <Separator />}
                <div className="flex items-center gap-3 px-4 py-3">
                  <Badge variant={alert.severity}>{alert.severity}</Badge>
                  <span className="shrink-0 rounded bg-bg-elevated px-2 py-0.5 font-mono text-[11px] text-text-secondary">
                    {alert.ruleId}
                  </span>
                  <span className="flex-1 truncate text-sm text-text-primary">{alert.message}</span>
                  {alert.count !== undefined && (
                    <span className="shrink-0 font-mono text-xs text-text-secondary">
                      ×{alert.count}
                    </span>
                  )}
                  <span className="shrink-0 font-mono text-xs text-text-secondary tabular-nums">
                    {formatDateTime(alert.timestamp)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </main>
  );
}
