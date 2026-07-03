'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Severity } from '@argus/contracts';
import { useRealtime } from '@/lib/realtime';
import { useMetrics } from '@/lib/use-metrics';
import { useMetricsHistory } from '@/lib/use-metrics-history';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const SEVERITY_ORDER: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];

const SEVERITY_VAR: Record<Severity, string> = {
  critical: 'var(--color-severity-critical)',
  high: 'var(--color-severity-high)',
  medium: 'var(--color-severity-medium)',
  low: 'var(--color-severity-low)',
  info: 'var(--color-severity-info)',
};

const TOOLTIP_STYLE = {
  background: 'var(--color-bg-elevated)',
  border: '1px solid var(--color-border-subtle)',
  borderRadius: 8,
  fontSize: 12,
};

const AXIS_TICK = { fill: 'var(--color-text-secondary)', fontSize: 10 };

function fadeIn(delay: number) {
  return {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.3, delay, ease: [0.16, 1, 0.3, 1] as const },
  };
}

function MetricCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div
          className={`font-mono text-2xl font-semibold tabular-nums ${accent ? 'text-accent' : 'text-text-primary'}`}
        >
          {value}
        </div>
        <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-text-secondary">
          {label}
        </div>
      </CardContent>
    </Card>
  );
}

function ChartEmpty({ label }: { label: string }) {
  return (
    <div className="flex h-full items-center justify-center text-sm text-text-secondary">
      {label}
    </div>
  );
}

export default function OverviewPage() {
  const { incidents } = useRealtime();
  const { data: metrics, isError } = useMetrics();
  const history = useMetricsHistory(metrics);

  const severityData = useMemo(
    () =>
      SEVERITY_ORDER.map((severity) => ({
        severity,
        count: incidents.filter((row) => row.incident.severity === severity).length,
      })),
    [incidents],
  );

  const hasActivity = history.some((point) => point.alerts > 0 || point.events > 0);
  const hasIncidents = incidents.length > 0;

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-text-primary">Overview</h1>
        {isError && (
          <span className="font-mono text-xs text-severity-critical">api unreachable</span>
        )}
      </div>

      <motion.div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4" {...fadeIn(0)}>
        <MetricCard
          label="events"
          value={metrics ? metrics.eventsNormalized.toLocaleString() : '—'}
        />
        <MetricCard label="alerts" value={metrics ? metrics.alertsRaised.toLocaleString() : '—'} />
        <MetricCard
          label="incidents"
          value={metrics ? metrics.incidentsOpened.toLocaleString() : '—'}
          accent
        />
        <MetricCard
          label="summaries"
          value={metrics ? metrics.summariesGenerated.toLocaleString() : '—'}
        />
      </motion.div>

      <div className="grid gap-4 lg:grid-cols-3">
        <motion.div className="lg:col-span-2" {...fadeIn(0.08)}>
          <Card>
            <CardHeader>
              <CardTitle>Pipeline activity</CardTitle>
            </CardHeader>
            <CardContent className="h-64 p-0 pr-4 pb-4">
              {hasActivity ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={history} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="alertsGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="var(--color-border-subtle)" vertical={false} />
                    <XAxis
                      dataKey="t"
                      tick={AXIS_TICK}
                      tickLine={false}
                      axisLine={{ stroke: 'var(--color-border-subtle)' }}
                    />
                    <YAxis
                      tick={AXIS_TICK}
                      tickLine={false}
                      axisLine={false}
                      width={28}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      labelStyle={{ color: 'var(--color-text-secondary)' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="alerts"
                      stroke="var(--color-accent)"
                      fill="url(#alertsGradient)"
                      strokeWidth={2}
                      name="alerts / interval"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <ChartEmpty label="Waiting for pipeline activity…" />
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div {...fadeIn(0.16)}>
          <Card>
            <CardHeader>
              <CardTitle>Incidents by severity</CardTitle>
            </CardHeader>
            <CardContent className="h-64 p-0 pr-4 pb-4">
              {hasIncidents ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={severityData}
                    layout="vertical"
                    margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
                  >
                    <CartesianGrid stroke="var(--color-border-subtle)" horizontal={false} />
                    <XAxis type="number" hide allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="severity"
                      tick={{ ...AXIS_TICK, fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      width={56}
                    />
                    <Tooltip
                      cursor={{ fill: 'var(--color-bg-elevated)' }}
                      contentStyle={TOOLTIP_STYLE}
                    />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {severityData.map((entry) => (
                        <Cell key={entry.severity} fill={SEVERITY_VAR[entry.severity]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <ChartEmpty label="No incidents yet." />
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </main>
  );
}
