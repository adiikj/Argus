'use client';

import { useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUpRight, Sparkles, X } from 'lucide-react';
import type { GeoPoint, Incident, Severity } from '@argus/contracts';
import { ruleInfo } from '@argus/contracts/rules';
import { useRealtime } from '@/lib/realtime';
import { useMetrics } from '@/lib/use-metrics';
import { useQueryIncidents } from '@/lib/use-incident-query';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AttackTechnique } from '../_components/attack-technique';
import { PageHeader } from '../_components/page-header';

const SEVERITY_ORDER: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];

const SEVERITY_DOT: Record<Severity, string> = {
  critical: 'bg-severity-critical',
  high: 'bg-severity-high',
  medium: 'bg-severity-medium',
  low: 'bg-severity-low',
  info: 'bg-severity-info',
};

const EXAMPLES = ['critical incidents', 'sqli in the last hour', 'open brute force'];

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour12: false });
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${seconds % 60}s`;
}

function describeFilter(filter: {
  ruleId?: string;
  severity?: string;
  status?: string;
  sinceMinutes?: number;
}): string {
  const parts: string[] = [];
  if (filter.ruleId) parts.push(`rule = ${ruleInfo(filter.ruleId)?.name ?? filter.ruleId}`);
  if (filter.severity) parts.push(`severity = ${filter.severity}`);
  if (filter.status) parts.push(`status = ${filter.status}`);
  if (filter.sinceMinutes) parts.push(`last ${filter.sinceMinutes} min`);
  return parts.length > 0 ? parts.join(' · ') : 'No filters recognized, showing recent incidents';
}

// one incident as a feed row — shared by the live feed and search results
function IncidentRowLink({
  incident,
  ruleId,
  message,
  geo,
  summary,
}: {
  incident: Incident;
  ruleId?: string;
  message?: string;
  geo?: GeoPoint | null;
  summary?: { summary: string; generatedBy: string };
}) {
  return (
    <Link
      href={`/incidents/${incident.incidentId}`}
      className="group relative flex flex-col gap-2 px-5 py-3.5 transition-colors hover:bg-bg-elevated/60"
    >
      <span
        className={cn(
          'absolute top-3 bottom-3 left-0 w-[3px] rounded-r-full',
          SEVERITY_DOT[incident.severity],
        )}
        style={{ opacity: incident.status === 'open' ? 1 : 0.35 }}
      />
      <div className="flex items-center gap-3">
        <Badge variant={incident.severity} className="w-[78px] shrink-0 justify-start">
          {incident.severity}
        </Badge>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[13.5px] font-medium text-text-primary">
              {ruleId ? (ruleInfo(ruleId)?.name ?? ruleId) : 'Incident'}
            </span>
            {ruleId && <AttackTechnique ruleId={ruleId} className="hidden md:inline" />}
            {incident.status !== 'open' && (
              <span className="hidden font-mono text-[10px] uppercase text-text-muted sm:inline">
                {incident.status.replace('_', ' ')}
              </span>
            )}
          </div>
          {message && (
            <p className="mt-0.5 truncate text-[12.5px] text-text-secondary">{message}</p>
          )}
        </div>
        <div className="hidden shrink-0 text-right sm:block">
          <div className="font-mono text-[12.5px] text-text-primary">{incident.correlationKey}</div>
          <div className="font-mono text-[10.5px] text-text-muted">
            {geo ? `${geo.countryName}${geo.source === 'simulated' ? ' · sim' : ''}` : '-'}
          </div>
        </div>
        <div className="w-20 shrink-0 text-right">
          <div className="font-mono text-[12.5px] tabular-nums text-text-secondary">
            {incident.alertIds.length} alert{incident.alertIds.length === 1 ? '' : 's'}
          </div>
          <div className="font-mono text-[10.5px] tabular-nums text-text-muted">
            {formatTime(incident.updatedAt)}
          </div>
        </div>
        <ArrowUpRight className="h-4 w-4 shrink-0 text-text-muted opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
      {summary && (
        <p className="ml-[90px] line-clamp-2 flex items-start gap-2 text-[12px] leading-relaxed text-text-muted">
          <span className="shrink-0 font-mono text-[10px] font-semibold text-accent uppercase">
            {summary.generatedBy === 'llm' ? 'AI' : 'auto'}
          </span>
          <span>{summary.summary}</span>
        </p>
      )}
    </Link>
  );
}

export default function AlertsPage() {
  const { incidents, summaries } = useRealtime();
  const { data: metrics } = useMetrics();
  const [filter, setFilter] = useState<Severity | 'all'>('all');
  const [question, setQuestion] = useState('');
  const {
    mutate: runQuery,
    data: queryResult,
    isPending: queryPending,
    reset: clearQuery,
  } = useQueryIncidents();

  const severityCounts = useMemo(() => {
    const counts: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    for (const row of incidents) counts[row.incident.severity] += 1;
    return counts;
  }, [incidents]);

  const visible =
    filter === 'all' ? incidents : incidents.filter((row) => row.incident.severity === filter);

  const ask = (q: string): void => {
    setQuestion(q);
    if (q.trim()) runQuery(q.trim());
  };
  const onSubmitQuery = (e: FormEvent): void => {
    e.preventDefault();
    ask(question);
  };

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Alerts"
        description="Incidents as they form, newest first."
        actions={
          metrics && (
            <span className="rounded-full border border-border-subtle bg-bg-panel px-3 py-1 font-mono text-[11px] text-text-secondary">
              pipeline up {formatUptime(metrics.uptimeSeconds)}
            </span>
          )
        }
      />

      <form
        onSubmit={onSubmitQuery}
        className="surface mb-5 rounded-xl border border-border-subtle p-1.5"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="ml-2.5 h-4 w-4 shrink-0 text-accent" />
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a question, like “sqli in the last hour”"
            className="h-9 min-w-0 flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
          />
          <Button type="submit" size="sm" disabled={!question.trim() || queryPending}>
            {queryPending ? 'Searching…' : 'Ask Argus'}
          </Button>
        </div>
        {!queryResult && (
          <div className="flex flex-wrap items-center gap-1.5 px-2.5 pt-1.5 pb-1">
            <span className="text-[11px] text-text-muted">try</span>
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => ask(ex)}
                className="rounded-md border border-border-subtle px-2 py-0.5 text-[11px] text-text-secondary transition-colors hover:border-accent/40 hover:text-text-primary"
              >
                {ex}
              </button>
            ))}
          </div>
        )}
      </form>

      {queryResult ? (
        <>
          <div className="mb-3 flex items-center justify-between gap-2 rounded-lg border border-accent/20 bg-accent/5 px-4 py-2.5 text-[12.5px] text-text-secondary">
            <span>
              <span className="text-accent">Interpreted as</span>{' '}
              {describeFilter(queryResult.filter)}
            </span>
            <button
              type="button"
              onClick={() => {
                clearQuery();
                setQuestion('');
              }}
              className="flex shrink-0 items-center gap-1 text-text-secondary hover:text-text-primary"
            >
              <X className="h-3.5 w-3.5" /> Clear
            </button>
          </div>

          {queryResult.incidents.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border-subtle py-24 text-center text-sm text-text-muted">
              No incidents matched that question.
            </div>
          ) : (
            <Card className="divide-y divide-border-subtle overflow-hidden">
              {queryResult.incidents.map((incident) => (
                <IncidentRowLink key={incident.incidentId} incident={incident} />
              ))}
            </Card>
          )}
        </>
      ) : (
        <div data-tour="alerts-feed">
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            <FilterChip
              label="All"
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
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border-subtle py-24 text-center">
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-50" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-accent" />
              </span>
              <p className="text-sm text-text-secondary">
                {incidents.length === 0
                  ? 'Listening for detections…'
                  : `No ${filter} incidents in view.`}
              </p>
              {incidents.length === 0 && (
                <Link href="/simulator" className="text-[12.5px] text-accent hover:underline">
                  Fire an attack from the simulator →
                </Link>
              )}
            </div>
          ) : (
            <Card className="overflow-hidden">
              <ul className="divide-y divide-border-subtle">
                <AnimatePresence initial={false}>
                  {visible.map(({ incident, latestAlert, geo }) => (
                    <motion.li
                      key={incident.incidentId}
                      layout
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <IncidentRowLink
                        incident={incident}
                        ruleId={latestAlert.ruleId}
                        message={latestAlert.message}
                        geo={geo}
                        summary={summaries[incident.incidentId]}
                      />
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            </Card>
          )}
        </div>
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
        'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] capitalize transition-colors',
        active
          ? 'border-accent/40 bg-accent/10 text-text-primary'
          : 'border-border-subtle bg-bg-panel text-text-secondary hover:border-border-strong hover:text-text-primary',
      )}
    >
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', dot)} />}
      {label}
      <span className="font-mono text-[11px] text-text-muted">{count}</span>
    </button>
  );
}
