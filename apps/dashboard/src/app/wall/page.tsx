'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Maximize2, ArrowLeft } from 'lucide-react';
import { useRealtime } from '@/lib/realtime';
import { useMetrics } from '@/lib/use-metrics';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Wordmark } from '../_components/wordmark';
import { PipelineFlow } from '../(app)/_components/pipeline-flow';
import { AttackerGeoMap } from '../(app)/_components/attacker-geo-map';
import { SystemActivity } from '../(app)/_components/system-activity';

function Clock() {
  const [now, setNow] = useState<Date | undefined>(undefined);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="font-mono text-sm tabular-nums text-text-secondary">
      {now ? now.toLocaleTimeString(undefined, { hour12: false }) : '--:--:--'}
    </span>
  );
}

function MetricTile({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div
          className={`font-mono text-4xl font-semibold tabular-nums ${accent ? 'text-accent' : 'text-text-primary'}`}
        >
          {value.toLocaleString()}
        </div>
        <div className="mt-1 font-mono text-xs uppercase tracking-wider text-text-secondary">
          {label}
        </div>
      </CardContent>
    </Card>
  );
}

export default function WallPage() {
  const { incidents, connected } = useRealtime();
  const { data: metrics } = useMetrics();
  const topIncidents = incidents.slice(0, 6);

  const enterFullscreen = (): void => {
    document.documentElement.requestFullscreen?.().catch(() => {
      // fullscreen requires a real user gesture and can be denied by the
      // browser — the wall still works fine windowed either way.
    });
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-bg-base text-text-primary">
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(var(--color-text-secondary) 1px, transparent 1px), linear-gradient(90deg, var(--color-text-secondary) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      <div className="relative flex h-full flex-col gap-4 p-6">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Wordmark />
            <span className="flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-accent">
              <span
                className={`h-1.5 w-1.5 rounded-full ${connected ? 'animate-pulse bg-accent' : 'bg-severity-info'}`}
              />
              {connected ? 'Live' : 'Reconnecting'}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Clock />
            <button
              type="button"
              onClick={enterFullscreen}
              className="flex items-center gap-1.5 rounded-md border border-border-subtle px-3 py-1.5 font-mono text-xs text-text-secondary transition-colors hover:border-accent/40 hover:text-text-primary"
            >
              <Maximize2 className="h-3.5 w-3.5" strokeWidth={1.8} />
              Fullscreen
            </button>
            <Link
              href="/overview"
              className="flex items-center gap-1.5 font-mono text-xs text-text-secondary transition-colors hover:text-text-primary"
            >
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.8} />
              Exit
            </Link>
          </div>
        </header>

        <div className="grid grid-cols-4 gap-4">
          <MetricTile label="events" value={metrics?.eventsNormalized ?? 0} />
          <MetricTile label="alerts" value={metrics?.alertsRaised ?? 0} />
          <MetricTile label="incidents" value={metrics?.incidentsOpened ?? 0} accent />
          <MetricTile label="summaries" value={metrics?.summariesGenerated ?? 0} />
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-3 gap-4">
          <div className="col-span-2">
            <PipelineFlow />
          </div>
          <AttackerGeoMap />
        </div>

        <div className="grid min-h-0 flex-[1.2] grid-cols-2 gap-4 overflow-hidden">
          <Card className="flex flex-col overflow-hidden">
            <CardHeader>
              <CardTitle>Top incidents</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-0">
              {topIncidents.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-text-secondary">
                  Waiting for detections…
                </div>
              ) : (
                <ul className="divide-y divide-border-subtle">
                  {topIncidents.map(({ incident, latestAlert }) => (
                    <li
                      key={incident.incidentId}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm"
                    >
                      <Badge variant={incident.severity}>{incident.severity}</Badge>
                      <span className="font-mono text-xs text-text-secondary">
                        {latestAlert.ruleId}
                      </span>
                      <span className="flex-1 truncate font-mono text-sm text-text-primary">
                        {incident.correlationKey}
                      </span>
                      <span className="shrink-0 font-mono text-xs text-text-secondary">
                        {incident.alertIds.length} alert{incident.alertIds.length === 1 ? '' : 's'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <div className="min-h-0">
            <SystemActivity />
          </div>
        </div>
      </div>
    </div>
  );
}
