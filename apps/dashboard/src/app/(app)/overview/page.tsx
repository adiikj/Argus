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
import Link from 'next/link';
import type { Severity } from '@argus/contracts';
import { useRealtime } from '@/lib/realtime';
import { useMetrics } from '@/lib/use-metrics';
import { useMetricsHistory } from '@/lib/use-metrics-history';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

const RULE_COLORS = [
  'var(--color-accent)',
  'var(--color-severity-high)',
  'var(--color-severity-medium)',
  'var(--color-severity-low)',
  'var(--color-severity-info)',
  'var(--color-severity-critical)',
];

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

function MetricCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | null;
  accent?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        {value === null ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <div
            className={`font-mono text-2xl font-semibold tabular-nums ${accent ? 'text-accent' : 'text-text-primary'}`}
          >
            {value}
          </div>
        )}
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

function ActivityHeatmap({ hourly }: { hourly: number[] }) {
  const max = Math.max(1, ...hourly);
  const hasAny = hourly.some((count) => count > 0);

  if (!hasAny) {
    return (
      <div className="flex h-20 items-center justify-center text-sm text-text-secondary">
        No alerts yet this session.
      </div>
    );
  }

  return (
    <div className="flex gap-1">
      {hourly.map((count, hour) => (
        <div key={hour} className="flex flex-1 flex-col items-center gap-1">
          <div
            className="h-14 w-full rounded-sm bg-accent"
            style={{ opacity: count > 0 ? 0.15 + (count / max) * 0.85 : 0.08 }}
            title={`${count} alert${count === 1 ? '' : 's'} around ${hour}:00`}
          />
          <span className="font-mono text-[8px] text-text-secondary">{hour}</span>
        </div>
      ))}
    </div>
  );
}

export default function OverviewPage() {
  const { incidents, ruleCounts, hourlyActivity } = useRealtime();
  const { data: metrics, isError } = useMetrics();
  const history = useMetricsHistory(metrics);

  const metricValue = (n: number | undefined): string | null => {
    if (metrics) return (n ?? 0).toLocaleString();
    return isError ? '—' : null;
  };

  const severityData = useMemo(
    () =>
      SEVERITY_ORDER.map((severity) => ({
        severity,
        count: incidents.filter((row) => row.incident.severity === severity).length,
      })),
    [incidents],
  );

  const topAttackers = useMemo(
    () =>
      [...incidents]
        .sort((a, b) => b.incident.alertIds.length - a.incident.alertIds.length)
        .slice(0, 6),
    [incidents],
  );

  const ruleData = useMemo(
    () =>
      Object.entries(ruleCounts)
        .map(([ruleId, count]) => ({ ruleId, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6),
    [ruleCounts],
  );

  const hasActivity = history.some((point) => point.alerts > 0 || point.events > 0);
  const hasIncidents = incidents.length > 0;
  const hasRuleData = ruleData.length > 0;

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-text-primary">Overview</h1>
        {isError && (
          <span className="font-mono text-xs text-severity-critical">api unreachable</span>
        )}
      </div>

      <motion.div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4" {...fadeIn(0)}>
        <MetricCard label="events" value={metricValue(metrics?.eventsNormalized)} />
        <MetricCard label="alerts" value={metricValue(metrics?.alertsRaised)} />
        <MetricCard label="incidents" value={metricValue(metrics?.incidentsOpened)} accent />
        <MetricCard label="summaries" value={metricValue(metrics?.summariesGenerated)} />
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

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <motion.div className="lg:col-span-2" {...fadeIn(0.24)}>
          <Card>
            <CardHeader>
              <CardTitle>Top attackers</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {topAttackers.length > 0 ? (
                <ul className="divide-y divide-border-subtle">
                  {topAttackers.map(({ incident }, i) => (
                    <li key={incident.incidentId}>
                      <Link
                        href={`/incidents/${incident.incidentId}`}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-bg-elevated"
                      >
                        <span className="w-4 shrink-0 font-mono text-xs text-text-secondary">
                          {i + 1}
                        </span>
                        <Badge variant={incident.severity}>{incident.severity}</Badge>
                        <span className="flex-1 truncate font-mono text-sm text-text-primary">
                          {incident.correlationKey}
                        </span>
                        <span className="shrink-0 font-mono text-xs text-text-secondary">
                          {incident.alertIds.length} alert
                          {incident.alertIds.length === 1 ? '' : 's'}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex h-32 items-center justify-center text-sm text-text-secondary">
                  No incidents yet.
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div {...fadeIn(0.32)}>
          <Card>
            <CardHeader>
              <CardTitle>Alerts by rule</CardTitle>
            </CardHeader>
            <CardContent className="h-64 p-0 pr-4 pb-4">
              {hasRuleData ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={ruleData}
                    layout="vertical"
                    margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
                  >
                    <CartesianGrid stroke="var(--color-border-subtle)" horizontal={false} />
                    <XAxis type="number" hide allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="ruleId"
                      tick={{ ...AXIS_TICK, fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      width={90}
                    />
                    <Tooltip
                      cursor={{ fill: 'var(--color-bg-elevated)' }}
                      contentStyle={TOOLTIP_STYLE}
                    />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {ruleData.map((entry, i) => (
                        <Cell key={entry.ruleId} fill={RULE_COLORS[i % RULE_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <ChartEmpty label="No alerts yet." />
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <motion.div className="mt-4" {...fadeIn(0.4)}>
        <Card>
          <CardHeader>
            <CardTitle>Activity by hour</CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <ActivityHeatmap hourly={hourlyActivity} />
          </CardContent>
        </Card>
      </motion.div>
    </main>
  );
}
