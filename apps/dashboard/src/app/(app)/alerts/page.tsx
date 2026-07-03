'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Severity } from '@argus/contracts';
import { useRealtime } from '@/lib/realtime';
import { useMetrics } from '@/lib/use-metrics';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const SEVERITY_ORDER: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];

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

export default function AlertsPage() {
  const { incidents, summaries } = useRealtime();
  const { data: metrics } = useMetrics();
  const [filter, setFilter] = useState<Severity | 'all'>('all');

  const severityCounts = useMemo(() => {
    const counts: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    for (const row of incidents) counts[row.incident.severity] += 1;
    return counts;
  }, [incidents]);

  const visible =
    filter === 'all' ? incidents : incidents.filter((row) => row.incident.severity === filter);

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-text-primary">Alerts</h1>
        {metrics && (
          <span className="font-mono text-xs text-text-secondary">
            uptime {formatUptime(metrics.uptimeSeconds)}
          </span>
        )}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FilterChip
          label="all"
          count={incidents.length}
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
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border-subtle py-24 text-center">
          <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
          <p className="text-sm text-text-secondary">
            {incidents.length === 0 ? 'Waiting for detections…' : `No ${filter} incidents in view.`}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {visible.map(({ incident, latestAlert }) => {
              const summary = summaries[incident.incidentId];
              return (
                <motion.li
                  key={incident.incidentId}
                  layout
                  initial={{ opacity: 0, y: -8, scale: 0.99 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                >
                  <Card className="flex flex-col gap-2 px-4 py-3">
                    <div className="flex items-center gap-4">
                      <Badge variant={incident.severity}>{incident.severity}</Badge>
                      <span className="hidden shrink-0 rounded bg-bg-elevated px-2 py-0.5 font-mono text-[11px] text-text-secondary sm:inline">
                        {latestAlert.ruleId}
                      </span>
                      <span className="shrink-0 font-mono text-sm text-text-secondary">
                        {incident.correlationKey}
                      </span>
                      <span className="flex-1 truncate text-sm text-text-primary">
                        {latestAlert.message}
                      </span>
                      <span className="shrink-0 font-mono text-xs text-text-secondary">
                        {incident.alertIds.length} alert{incident.alertIds.length === 1 ? '' : 's'}
                      </span>
                      <span className="shrink-0 font-mono text-xs text-text-secondary tabular-nums">
                        {formatTime(incident.updatedAt)}
                      </span>
                    </div>
                    {summary && (
                      <p className="flex items-start gap-2 pl-1 text-xs text-text-secondary">
                        <span className="mt-0.5 shrink-0 rounded bg-bg-elevated px-1.5 py-0.5 font-mono text-[10px] uppercase text-accent">
                          {summary.generatedBy}
                        </span>
                        <span>{summary.summary}</span>
                      </p>
                    )}
                  </Card>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </main>
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
      className={cn(
        'flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-xs transition-colors',
        active
          ? 'border-accent/40 bg-accent/10 text-text-primary'
          : 'border-border-subtle bg-bg-panel text-text-secondary hover:border-text-secondary',
      )}
    >
      {dot && <span className={cn('h-2 w-2 rounded-full', dot)} />}
      {label}
      <span className="text-text-secondary">{count}</span>
    </button>
  );
}
