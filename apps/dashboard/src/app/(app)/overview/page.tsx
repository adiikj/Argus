'use client';

import { useMemo } from 'react';
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

export default function OverviewPage() {
  const { incidents } = useRealtime();
  const { data: metrics } = useMetrics();
  const history = useMetricsHistory(metrics);

  const severityData = useMemo(
    () =>
      SEVERITY_ORDER.map((severity) => ({
        severity,
        count: incidents.filter((row) => row.incident.severity === severity).length,
      })),
    [incidents],
  );

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="mb-6 text-lg font-semibold text-text-primary">Overview</h1>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
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
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Pipeline activity</CardTitle>
          </CardHeader>
          <CardContent className="h-64 p-0 pr-4 pb-4">
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Incidents by severity</CardTitle>
          </CardHeader>
          <CardContent className="h-64 p-0 pr-4 pb-4">
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
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
