'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { DurationStat, RuleMetrics } from '@argus/contracts';
import { ruleInfo } from '@argus/contracts/rules';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDuration, formatRate, useSocMetrics } from '@/lib/use-soc-metrics';
import { cn } from '@/lib/utils';
import { AttackTechnique } from '../_components/attack-technique';
import { PageHeader } from '../_components/page-header';

const RANGES = [7, 30, 90] as const;

const TOOLTIP_STYLE = {
  background: 'var(--color-bg-elevated)',
  border: '1px solid var(--color-border-strong)',
  borderRadius: 10,
  fontSize: 12,
  boxShadow: '0 12px 32px rgb(0 0 0 / 0.45)',
};

const AXIS_TICK = { fill: 'var(--color-text-muted)', fontSize: 10 };

// a false-positive rate this high means the rule needs tuning
const NOISY = 0.5;

function Tile({
  label,
  value,
  hint,
  loading,
  className,
}: {
  label: string;
  value: string;
  hint: ReactNode;
  loading: boolean;
  className?: string;
}) {
  return (
    <Card className={cn('px-5 py-4', className)}>
      <div className="text-[12px] font-medium text-text-secondary">{label}</div>
      {loading ? (
        <Skeleton className="mt-3 h-8 w-20" />
      ) : (
        <div className="mt-2 font-mono text-[26px] leading-none font-semibold tracking-tight tabular-nums text-text-primary">
          {value}
        </div>
      )}
      <div className="mt-2 text-[11px] leading-snug text-text-muted">{hint}</div>
    </Card>
  );
}

function durationHint(stat: DurationStat | undefined, what: string): string {
  if (!stat || stat.samples === 0) return what;
  return `${what} · median ${formatDuration(stat.median)} · n=${stat.samples}`;
}

function FpBar({ rate }: { rate: number | null }) {
  if (rate === null) return <span className="font-mono text-xs text-text-muted">-</span>;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-bg-elevated">
        <div
          className={cn('h-full rounded-full', rate >= NOISY ? 'bg-severity-high' : 'bg-accent')}
          style={{ width: rate > 0 ? `${Math.max(rate * 100, 3)}%` : 0 }}
        />
      </div>
      <span className="w-9 text-right font-mono text-xs tabular-nums text-text-secondary">
        {formatRate(rate)}
      </span>
    </div>
  );
}

function RuleTable({ rules }: { rules: RuleMetrics[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left">
        <thead>
          <tr className="border-b border-border-subtle font-mono text-[10.5px] tracking-[0.12em] text-text-muted uppercase">
            <th className="px-5 py-3 font-medium">Rule</th>
            <th className="px-3 py-3 text-right font-medium">Alerts</th>
            <th className="px-3 py-3 text-right font-medium">Incidents</th>
            <th className="px-3 py-3 text-right font-medium">Closed</th>
            <th className="px-3 py-3 font-medium">False positive</th>
            <th className="px-5 py-3 text-right font-medium">MTTD</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {rules.map((r) => (
            <tr key={r.ruleId}>
              <td className="px-5 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] text-text-primary">
                    {ruleInfo(r.ruleId)?.name ?? r.ruleId}
                  </span>
                  <AttackTechnique ruleId={r.ruleId} />
                  {r.falsePositiveRate !== null && r.falsePositiveRate >= NOISY && (
                    <Badge variant="high">noisy</Badge>
                  )}
                </div>
              </td>
              <td className="px-3 py-3 text-right font-mono text-xs tabular-nums text-text-secondary">
                {r.alerts}
              </td>
              <td className="px-3 py-3 text-right font-mono text-xs tabular-nums text-text-secondary">
                {r.incidents}
              </td>
              <td className="px-3 py-3 text-right font-mono text-xs tabular-nums text-text-secondary">
                {r.closed}
              </td>
              <td className="px-3 py-3">
                <FpBar rate={r.falsePositiveRate} />
              </td>
              <td className="px-5 py-3 text-right font-mono text-xs tabular-nums text-text-secondary">
                {formatDuration(r.mttdSeconds)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SocMetricsView() {
  const [days, setDays] = useState<number>(30);
  const { data, isLoading, isError } = useSocMetrics(days);
  const loading = isLoading && !data;
  const daily = (data?.daily ?? []).map((d) => ({ ...d, label: d.date.slice(5) }));
  const hasDaily = daily.some((d) => d.opened > 0 || d.closed > 0);

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="SOC Metrics"
        description="How fast attacks are caught and handled, and which rules cry wolf."
        actions={
          <div className="flex gap-1 rounded-xl border border-border-subtle bg-bg-panel/60 p-1">
            {RANGES.map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={days === d}
                onClick={() => setDays(d)}
                className={cn(
                  'rounded-lg px-3 py-1.5 font-mono text-[12px] transition-colors',
                  days === d
                    ? 'bg-bg-elevated text-text-primary shadow-[inset_0_1px_0_rgb(255_255_255/0.05)]'
                    : 'text-text-secondary hover:text-text-primary',
                )}
              >
                {d}d
              </button>
            ))}
          </div>
        }
      />

      {isError && !data && (
        <p className="mb-6 text-sm text-severity-critical">Could not load metrics from the api.</p>
      )}

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5">
        <Tile
          label="MTTD"
          value={formatDuration(data?.mttd.mean ?? null)}
          hint={durationHint(data?.mttd, 'first evidence to incident')}
          loading={loading}
        />
        <Tile
          label="MTTA"
          value={formatDuration(data?.mtta.mean ?? null)}
          hint={durationHint(data?.mtta, 'incident to first triage')}
          loading={loading}
        />
        <Tile
          label="MTTR"
          value={formatDuration(data?.mttr.mean ?? null)}
          hint={durationHint(data?.mttr, 'incident to closed')}
          loading={loading}
        />
        <Tile
          label="False-positive rate"
          value={formatRate(data?.falsePositiveRate ?? null)}
          hint={data ? `${data.falsePositives} of ${data.closed} closed incidents` : 'of closed'}
          loading={loading}
        />
        <Tile
          label="Backlog"
          className="col-span-2 lg:col-span-1"
          value={String(data?.backlog ?? '-')}
          hint={data ? `open or acknowledged, of ${data.incidents} opened` : 'open incidents'}
          loading={loading}
        />
      </div>

      <div className="grid gap-4">
        <Card>
          <CardHeader className="flex-row items-start justify-between">
            <div>
              <CardTitle>Opened vs closed</CardTitle>
              <CardDescription>Incidents per day (UTC)</CardDescription>
            </div>
            <div className="flex items-center gap-3 font-mono text-[11px] text-text-secondary">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-text-secondary" /> opened
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-accent" /> closed
              </span>
            </div>
          </CardHeader>
          <CardContent className="h-56 pr-3">
            {loading ? (
              <Skeleton className="h-full w-full" />
            ) : hasDaily ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={daily}
                  margin={{ top: 6, right: 6, left: -8, bottom: 0 }}
                  barGap={2}
                >
                  <CartesianGrid
                    stroke="var(--color-border-subtle)"
                    strokeDasharray="3 5"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    tick={AXIS_TICK}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={24}
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
                    cursor={{ fill: 'var(--color-bg-hover)' }}
                  />
                  <Bar
                    dataKey="opened"
                    fill="var(--color-text-secondary)"
                    radius={[3, 3, 0, 0]}
                    isAnimationActive={false}
                  />
                  <Bar
                    dataKey="closed"
                    fill="var(--color-accent)"
                    radius={[3, 3, 0, 0]}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-border-subtle text-sm text-text-muted">
                No incidents in this range.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Per rule</CardTitle>
            <CardDescription>
              Closing an incident as a false positive counts against every rule in it.
            </CardDescription>
          </CardHeader>
          {loading ? (
            <CardContent>
              <Skeleton className="h-40 w-full" />
            </CardContent>
          ) : data && data.rules.length > 0 ? (
            <RuleTable rules={data.rules} />
          ) : (
            <CardContent>
              <div className="py-10 text-center text-sm text-text-muted">
                No alerts in this range.{' '}
                <Link href="/simulator" className="text-accent hover:underline">
                  Fire one from the simulator →
                </Link>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </main>
  );
}
