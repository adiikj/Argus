'use client';

import { useMemo, type ReactNode } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Activity, ArrowUpRight, Bell, Filter, ShieldAlert, Tv } from 'lucide-react';
import type { Severity } from '@argus/contracts';
import { ruleInfo } from '@argus/contracts/rules';
import { useRealtime } from '@/lib/realtime';
import { useMetrics } from '@/lib/use-metrics';
import { useMetricsHistory } from '@/lib/use-metrics-history';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkline } from '@/components/ui/sparkline';
import { cn } from '@/lib/utils';
import { AttackerGeoMap } from '../_components/attacker-geo-map';
import { AttackTechnique } from '../_components/attack-technique';
import { PageHeader } from '../_components/page-header';

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
  border: '1px solid var(--color-border-strong)',
  borderRadius: 10,
  fontSize: 12,
  boxShadow: '0 12px 32px rgb(0 0 0 / 0.45)',
};

const AXIS_TICK = { fill: 'var(--color-text-muted)', fontSize: 10 };

function fadeIn(delay: number) {
  return {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.35, delay, ease: [0.16, 1, 0.3, 1] as const },
  };
}

function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  trend,
  trendColor,
  accent,
}: {
  label: string;
  value: string | null;
  hint?: ReactNode;
  icon: typeof Activity;
  trend?: number[];
  trendColor?: string;
  accent?: boolean;
}) {
  return (
    <Card
      className={cn(
        'overflow-hidden',
        accent &&
          'border-accent/25 shadow-[0_0_0_1px_color-mix(in_srgb,var(--color-accent)_10%,transparent),0_12px_40px_-16px_var(--color-accent)]',
      )}
    >
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-medium text-text-secondary">{label}</span>
          <span
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-lg border',
              accent
                ? 'border-accent/30 bg-accent/10 text-accent'
                : 'border-border-subtle bg-bg-elevated text-text-muted',
            )}
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={2} />
          </span>
        </div>
        <div className="mt-3 flex items-end justify-between gap-4">
          <div className="min-w-0">
            {value === null ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="font-mono text-[22px] font-semibold leading-none tracking-tight tabular-nums text-text-primary sm:text-[28px]">
                {value}
              </div>
            )}
            {hint && <div className="mt-2 hidden text-[11px] text-text-muted sm:block">{hint}</div>}
          </div>
          {trend && (
            <div className="hidden w-24 shrink-0 sm:block">
              <Sparkline data={trend} color={trendColor} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Empty({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'flex h-full min-h-32 items-center justify-center rounded-lg border border-dashed border-border-subtle text-sm text-text-muted',
        className,
      )}
    >
      {children}
    </div>
  );
}

function SeverityBreakdown({ counts, total }: { counts: Record<Severity, number>; total: number }) {
  if (total === 0) return <Empty>No incidents yet.</Empty>;
  return (
    <div className="space-y-4">
      {/* one stacked bar — the shape of the threat landscape at a glance */}
      <div className="flex h-2.5 overflow-hidden rounded-full bg-bg-elevated">
        {SEVERITY_ORDER.map((s) =>
          counts[s] > 0 ? (
            <div
              key={s}
              style={{ width: `${(counts[s] / total) * 100}%`, background: SEVERITY_VAR[s] }}
            />
          ) : null,
        )}
      </div>
      <ul className="space-y-2.5">
        {SEVERITY_ORDER.map((s) => (
          <li key={s} className="flex items-center gap-3">
            <Badge variant={s} className="w-[76px] justify-start">
              {s}
            </Badge>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg-elevated">
              <div
                className="h-full rounded-full"
                style={{ width: `${(counts[s] / total) * 100}%`, background: SEVERITY_VAR[s] }}
              />
            </div>
            <span className="w-8 text-right font-mono text-xs tabular-nums text-text-secondary">
              {counts[s]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function HourHeatmap({ hourly }: { hourly: number[] }) {
  const max = Math.max(1, ...hourly);
  if (!hourly.some((n) => n > 0)) return <Empty className="min-h-20">No alerts yet.</Empty>;
  return (
    <div>
      <div className="flex h-44 items-end gap-1">
        {hourly.map((count, hour) => (
          <div
            key={hour}
            className="group relative flex h-full flex-1 items-end"
            title={`${count} alert${count === 1 ? '' : 's'} around ${hour}:00 UTC`}
          >
            <div
              className="w-full rounded-t-[4px] transition-opacity group-hover:opacity-100"
              style={{
                height: `${Math.max(4, (count / max) * 100)}%`,
                opacity: count > 0 ? 0.45 + (count / max) * 0.55 : 0.25,
                background:
                  count > 0
                    ? 'linear-gradient(180deg, var(--color-accent), color-mix(in srgb, var(--color-accent-2) 70%, transparent))'
                    : 'var(--color-bg-hover)',
              }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between font-mono text-[10px] text-text-muted">
        <span>00:00</span>
        <span>06:00</span>
        <span>12:00</span>
        <span>18:00</span>
        <span>23:00</span>
      </div>
    </div>
  );
}

export default function OverviewPage() {
  const { incidents, ruleCounts, hourlyActivity } = useRealtime();
  const { data: metrics, isError } = useMetrics();
  const history = useMetricsHistory(metrics);

  const fmt = (n: number | undefined): string | null => {
    if (metrics) return (n ?? 0).toLocaleString();
    return isError ? '—' : null;
  };

  const severityCounts = useMemo(() => {
    const counts: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    for (const row of incidents) counts[row.incident.severity] += 1;
    return counts;
  }, [incidents]);

  const openCount = incidents.filter((r) => r.incident.status === 'open').length;

  const topSources = useMemo(
    () =>
      [...incidents]
        .sort((a, b) => b.incident.alertIds.length - a.incident.alertIds.length)
        .slice(0, 6),
    [incidents],
  );
  const maxAlerts = Math.max(1, ...topSources.map((r) => r.incident.alertIds.length));

  const ruleData = useMemo(
    () =>
      Object.entries(ruleCounts)
        .map(([ruleId, count]) => ({ ruleId, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 7),
    [ruleCounts],
  );
  const maxRule = Math.max(1, ...ruleData.map((r) => r.count));
  const hasActivity = history.some((p) => p.alerts > 0 || p.events > 0);

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Overview"
        description="The live state of the pipeline — what's flowing through it, what it caught, and where it came from."
        actions={
          <>
            {isError && <Badge variant="critical">api unreachable</Badge>}
            <Button asChild variant="outline" size="sm">
              <Link href="/wall">
                <Tv /> SOC wall
              </Link>
            </Button>
          </>
        }
      />

      <motion.div
        data-tour="overview-metrics"
        className="mb-4 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4"
        {...fadeIn(0)}
      >
        <StatTile
          label="Events processed"
          value={fmt(metrics?.eventsNormalized)}
          icon={Activity}
          trend={history.map((p) => p.events)}
          hint="normalized from raw logs"
        />
        <StatTile
          label="Alerts raised"
          value={fmt(metrics?.alertsRaised)}
          icon={Bell}
          trend={history.map((p) => p.alerts)}
          trendColor="var(--color-severity-high)"
          hint={`${Object.keys(ruleCounts).length} rules have fired`}
        />
        <StatTile
          label="Open incidents"
          value={metrics || incidents.length ? openCount.toLocaleString() : null}
          icon={ShieldAlert}
          accent
          hint={
            severityCounts.critical > 0 ? (
              <span className="text-severity-critical">{severityCounts.critical} critical</span>
            ) : (
              'none critical'
            )
          }
        />
        <StatTile
          label="Noise suppressed"
          value={fmt(metrics?.alertsSuppressed)}
          icon={Filter}
          hint="repeat alerts held back by throttling"
        />
      </motion.div>

      <div className="grid gap-4 xl:grid-cols-3">
        <motion.div className="xl:col-span-2" {...fadeIn(0.06)}>
          <Card className="h-full">
            <CardHeader className="flex-row items-start justify-between">
              <div>
                <CardTitle>Pipeline throughput</CardTitle>
                <CardDescription>Events and alerts per 3 s interval, this session</CardDescription>
              </div>
              <div className="flex items-center gap-3 font-mono text-[11px] text-text-secondary">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-accent" /> events
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-severity-high" /> alerts
                </span>
              </div>
            </CardHeader>
            <CardContent className="h-64 pr-3">
              {hasActivity ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={history} margin={{ top: 6, right: 6, left: -8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="evGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="alGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="0%"
                          stopColor="var(--color-severity-high)"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="100%"
                          stopColor="var(--color-severity-high)"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      stroke="var(--color-border-subtle)"
                      strokeDasharray="3 5"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="t"
                      tick={AXIS_TICK}
                      tickLine={false}
                      axisLine={false}
                      minTickGap={40}
                    />
                    <YAxis
                      tick={AXIS_TICK}
                      tickLine={false}
                      axisLine={false}
                      width={32}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      labelStyle={{ color: 'var(--color-text-secondary)' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="events"
                      stroke="var(--color-accent)"
                      fill="url(#evGrad)"
                      strokeWidth={2}
                      isAnimationActive={false}
                    />
                    <Area
                      type="monotone"
                      dataKey="alerts"
                      stroke="var(--color-severity-high)"
                      fill="url(#alGrad)"
                      strokeWidth={2}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <Empty>Waiting for pipeline activity…</Empty>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div {...fadeIn(0.12)}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Incidents by severity</CardTitle>
              <CardDescription>{incidents.length} recent incidents</CardDescription>
            </CardHeader>
            <CardContent>
              <SeverityBreakdown counts={severityCounts} total={incidents.length} />
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <motion.div className="xl:col-span-2" {...fadeIn(0.18)}>
          <AttackerGeoMap />
        </motion.div>

        <motion.div data-tour="top-attackers" {...fadeIn(0.24)}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Top sources</CardTitle>
              <CardDescription>
                Incidents ranked by alert volume · * simulated location
              </CardDescription>
            </CardHeader>
            <CardContent className="px-2">
              {topSources.length > 0 ? (
                <ul>
                  {topSources.map(({ incident, geo }, i) => (
                    <li key={incident.incidentId}>
                      <Link
                        href={`/incidents/${incident.incidentId}`}
                        className="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-bg-elevated"
                      >
                        <span className="w-4 shrink-0 font-mono text-[11px] text-text-muted">
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-mono text-[13px] text-text-primary">
                              {incident.correlationKey}
                            </span>
                            {geo && (
                              <span className="shrink-0 font-mono text-[10px] text-text-muted">
                                {geo.country}
                                {geo.source === 'simulated' ? '*' : ''}
                              </span>
                            )}
                          </div>
                          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-bg-elevated">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${(incident.alertIds.length / maxAlerts) * 100}%`,
                                background: SEVERITY_VAR[incident.severity],
                              }}
                            />
                          </div>
                        </div>
                        <span className="shrink-0 font-mono text-[11px] tabular-nums text-text-secondary">
                          {incident.alertIds.length}
                        </span>
                        <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-text-muted opacity-0 transition-opacity group-hover:opacity-100" />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty>No incidents yet.</Empty>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-5">
        <motion.div className="xl:col-span-3" {...fadeIn(0.3)}>
          <Card className="h-full">
            <CardHeader className="flex-row items-start justify-between">
              <div>
                <CardTitle>Detections by rule</CardTitle>
                <CardDescription>
                  All-time alert volume per rule, with its ATT&amp;CK technique
                </CardDescription>
              </div>
              <Link href="/coverage" className="font-mono text-[11px] text-accent hover:underline">
                coverage →
              </Link>
            </CardHeader>
            <CardContent>
              {ruleData.length > 0 ? (
                <ul className="space-y-3">
                  {ruleData.map(({ ruleId, count }) => (
                    <li
                      key={ruleId}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-[13px] text-text-primary">
                          {ruleInfo(ruleId)?.name ?? ruleId}
                        </span>
                        <AttackTechnique ruleId={ruleId} />
                      </div>
                      <span className="font-mono text-xs tabular-nums text-text-secondary">
                        {count}
                      </span>
                      <div className="col-span-2 h-1.5 overflow-hidden rounded-full bg-bg-elevated">
                        <div
                          className="bg-brand h-full rounded-full"
                          style={{
                            width: `${(count / maxRule) * 100}%`,
                            opacity: 0.35 + (count / maxRule) * 0.65,
                          }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty>No alerts yet.</Empty>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div className="xl:col-span-2" {...fadeIn(0.36)}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Activity by hour</CardTitle>
              <CardDescription>All-time alerts by hour of day (UTC)</CardDescription>
            </CardHeader>
            <CardContent>
              <HourHeatmap hourly={hourlyActivity} />
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </main>
  );
}
