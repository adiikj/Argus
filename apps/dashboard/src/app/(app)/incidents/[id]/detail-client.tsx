'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import type { Incident, IncidentStatus, IpReputation } from '@argus/contracts';
import { useIncidentDetail } from '@/lib/use-incident-detail';
import { usePatchIncident } from '@/lib/use-incident-mutation';
import { useUsers } from '@/lib/use-users';
import { useSessionRole } from '@/lib/use-session-role';
import { useRealtime } from '@/lib/realtime';
import { ruleInfo } from '@argus/contracts/rules';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { KillChain } from '../../_components/kill-chain';
import { AttackTechnique } from '../../_components/attack-technique';
import { AuditTrail } from '../../_components/audit-trail';

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { hour12: false });
}

function fadeIn(delay: number) {
  return {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.3, delay, ease: [0.16, 1, 0.3, 1] as const },
  };
}

const STATUS_VARIANT: Record<IncidentStatus, BadgeProps['variant']> = {
  open: 'outline',
  acknowledged: 'medium',
  resolved: 'low',
  false_positive: 'default',
};

const STATUS_LABEL: Record<IncidentStatus, string> = {
  open: 'Reopen',
  acknowledged: 'Acknowledge',
  resolved: 'Resolve',
  false_positive: 'Mark false positive',
};

// client-side copy of apps/api/src/incident/transitions.ts, for UI purposes
// only — the server independently re-validates every transition.
const TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
  open: ['acknowledged', 'resolved', 'false_positive'],
  acknowledged: ['resolved', 'false_positive', 'open'],
  resolved: ['open'],
  false_positive: ['open'],
};

function needsNote(status: IncidentStatus): boolean {
  return status === 'resolved' || status === 'false_positive';
}

function ResolutionNote({ note }: { note: string }) {
  return (
    <div>
      <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-text-secondary">
        Resolution note
      </p>
      <p className="text-sm text-text-secondary">{note}</p>
    </div>
  );
}

// a viewer (the public demo account) can't triage — the api 403s every write,
// so show why instead of buttons that would only fail.
function ReadOnlyActions({ incident }: { incident: Incident }) {
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-text-secondary">
          This is a read-only account, so triage actions are disabled.
        </p>
        {incident.resolutionNote && <ResolutionNote note={incident.resolutionNote} />}
      </CardContent>
    </Card>
  );
}

function IncidentActions({ incident }: { incident: Incident }) {
  const { mutate, isPending } = usePatchIncident(incident.incidentId);
  const { data: users } = useUsers();
  const [pendingNoteStatus, setPendingNoteStatus] = useState<IncidentStatus | null>(null);
  const [note, setNote] = useState('');

  const fireTransition = (status: IncidentStatus): void => {
    if (needsNote(status) && !incident.resolutionNote) {
      setPendingNoteStatus(status);
      return;
    }
    mutate({ status });
  };

  const confirmWithNote = (): void => {
    if (!pendingNoteStatus || !note.trim()) return;
    mutate({ status: pendingNoteStatus, resolutionNote: note.trim() });
    setPendingNoteStatus(null);
    setNote('');
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {TRANSITIONS[incident.status].map((status) => (
            <Button
              key={status}
              size="sm"
              variant={status === 'open' ? 'outline' : 'secondary'}
              disabled={isPending}
              onClick={() => fireTransition(status)}
            >
              {STATUS_LABEL[status]}
            </Button>
          ))}
        </div>

        {pendingNoteStatus && (
          <div className="space-y-2 rounded-md border border-border-subtle p-3">
            <p className="text-xs text-text-secondary">
              {STATUS_LABEL[pendingNoteStatus]} requires a resolution note.
            </p>
            <Textarea
              autoFocus
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="what happened, and how it was handled…"
            />
            <div className="flex gap-2">
              <Button size="sm" disabled={!note.trim() || isPending} onClick={confirmWithNote}>
                Confirm
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setPendingNoteStatus(null);
                  setNote('');
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <label htmlFor="assignee" className="text-xs text-text-secondary">
            Assignee
          </label>
          <select
            id="assignee"
            value={incident.assigneeId ?? ''}
            disabled={isPending}
            onChange={(e) => mutate({ assigneeId: e.target.value || null })}
            className="rounded-md border border-border-subtle bg-bg-panel px-2 py-1 text-sm text-text-primary focus:border-accent/50 focus:outline-none"
          >
            <option value="">Unassigned</option>
            {users?.map((u) => (
              <option key={u.userId} value={u.userId}>
                {u.name ?? u.email}
              </option>
            ))}
          </select>
        </div>

        {incident.resolutionNote && <ResolutionNote note={incident.resolutionNote} />}
      </CardContent>
    </Card>
  );
}

function scoreVariant(score: number): BadgeProps['variant'] {
  if (score >= 75) return 'critical';
  if (score >= 25) return 'medium';
  return 'low';
}

function Fact({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-wider text-text-secondary">
        {label}
      </dt>
      <dd className="text-sm text-text-primary">{value}</dd>
    </div>
  );
}

// source-IP reputation from AbuseIPDB (cached server-side; viewing never
// spends lookup quota). Only real public IPs get one — demo traffic doesn't.
function ThreatIntelCard({ reputation }: { reputation: IpReputation }) {
  return (
    <Card className="mb-6">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Threat intel</CardTitle>
        <a
          href={`https://www.abuseipdb.com/check/${encodeURIComponent(reputation.ip)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-[11px] text-accent hover:underline"
        >
          AbuseIPDB ↗
        </a>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <Badge variant={scoreVariant(reputation.abuseScore)}>
            abuse {reputation.abuseScore}/100
          </Badge>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg-elevated">
            <div
              className="h-full rounded-full bg-current"
              style={{
                width: `${reputation.abuseScore}%`,
                color: `var(--color-severity-${scoreVariant(reputation.abuseScore)})`,
              }}
            />
          </div>
          {reputation.isTor && <Badge variant="high">tor exit</Badge>}
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          <Fact
            label="Reports"
            value={`${reputation.totalReports} from ${reputation.distinctReporters} source${reputation.distinctReporters === 1 ? '' : 's'}`}
          />
          <Fact label="Usage" value={reputation.usageType} />
          <Fact label="ISP" value={reputation.isp} />
          <Fact label="Domain" value={reputation.domain} />
          <Fact label="Country" value={reputation.countryCode} />
          <Fact
            label="Last reported"
            value={reputation.lastReportedAt ? formatDateTime(reputation.lastReportedAt) : 'never'}
          />
        </dl>
        <p className="font-mono text-[10px] text-text-secondary">
          checked {formatDateTime(reputation.checkedAt)}
        </p>
      </CardContent>
    </Card>
  );
}

export function IncidentDetailClient({ id }: { id: string }) {
  const { data, isLoading, isError } = useIncidentDetail(id);
  const role = useSessionRole();
  const { incidents: liveRows } = useRealtime();
  const { data: users } = useUsers(role !== null && role !== 'viewer');

  if (isLoading) {
    return <div className="px-6 py-8 text-sm text-text-secondary">Loading incident…</div>;
  }

  if (isError || !data) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm text-text-secondary">
          Couldn&apos;t find that incident. It may have rolled out of view, or the api isn&apos;t
          reachable.
        </p>
        <Link href="/alerts" className="text-xs text-accent hover:underline">
          ← back to alerts
        </Link>
      </div>
    );
  }

  const { incident, alerts, summary, reputation, activity = [] } = data;
  const nameOf = (userId: string) => {
    const user = users?.find((u) => u.userId === userId);
    return user ? (user.name ?? user.email) : 'someone';
  };
  const geo = liveRows.find((r) => r.incident.incidentId === incident.incidentId)?.geo;

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/incidents"
        className="mb-5 inline-flex items-center gap-1.5 text-[12.5px] text-text-secondary hover:text-text-primary"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Incidents
      </Link>

      <motion.div {...fadeIn(0)}>
        <Card className="relative mb-5 overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 w-1"
            style={{ background: `var(--color-severity-${incident.severity})` }}
          />
          <div className="flex flex-wrap items-start justify-between gap-6 px-6 py-5">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge variant={incident.severity}>{incident.severity}</Badge>
                <Badge variant={STATUS_VARIANT[incident.status]}>
                  {incident.status.replace('_', ' ')}
                </Badge>
              </div>
              <h1 className="font-mono text-[26px] font-semibold tracking-tight text-text-primary">
                {incident.correlationKey}
              </h1>
              <p className="mt-1 text-[12.5px] text-text-muted">
                {geo
                  ? `${geo.countryName}${geo.source === 'simulated' ? ' (simulated location)' : ''} · `
                  : ''}
                incident {incident.incidentId.slice(0, 8)}
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-4">
              {[
                ['Alerts', String(alerts.length)],
                ['Events', String(incident.eventIds.length)],
                ['Opened', formatDateTime(incident.createdAt)],
                ['Updated', formatDateTime(incident.updatedAt)],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-muted">
                    {label}
                  </dt>
                  <dd className="mt-0.5 font-mono text-[13px] tabular-nums text-text-primary">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </Card>
      </motion.div>

      <div className="grid items-start gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <motion.div {...fadeIn(0.06)}>
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <span className="text-accent">AI summary</span>
                </CardTitle>
                {summary && (
                  <span className="font-mono text-[10.5px] uppercase text-text-muted">
                    {summary.generatedBy === 'llm' ? 'llm' : 'template'} ·{' '}
                    {formatDateTime(summary.generatedAt)}
                  </span>
                )}
              </CardHeader>
              <CardContent>
                {summary ? (
                  <div className="space-y-5">
                    <p className="text-[14.5px] leading-relaxed text-text-primary">
                      {summary.summary}
                    </p>
                    {summary.recommendedActions.length > 0 && (
                      <div>
                        <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-text-muted">
                          Recommended actions
                        </p>
                        <ol className="space-y-2">
                          {summary.recommendedActions.map((action, i) => (
                            <li key={action} className="flex gap-3 text-[13px] text-text-secondary">
                              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-accent/30 bg-accent/10 font-mono text-[10px] text-accent">
                                {i + 1}
                              </span>
                              {action}
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                    {summary.iocs.length > 0 && (
                      <div>
                        <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-text-muted">
                          Indicators
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {summary.iocs.map((ioc) => (
                            <span
                              key={ioc}
                              className="rounded-md border border-border-strong bg-bg-elevated px-2 py-0.5 font-mono text-[11.5px] text-text-primary"
                            >
                              {ioc}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-text-muted">
                    No summary yet. One is written shortly after the incident settles.
                  </p>
                )}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div {...fadeIn(0.12)}>
            <KillChain alerts={alerts} />
          </motion.div>

          <motion.div {...fadeIn(0.18)}>
            <Card>
              <CardHeader>
                <CardTitle>Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="relative">
                  <span
                    aria-hidden
                    className="absolute top-2 bottom-2 left-[5px] w-px bg-border-strong"
                  />
                  {alerts.map((alert) => (
                    <li key={alert.alertId} className="relative flex gap-4 pb-5 last:pb-0">
                      <span
                        className="relative z-10 mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full border-2 border-bg-panel"
                        style={{ background: `var(--color-severity-${alert.severity})` }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[13.5px] font-medium text-text-primary">
                            {ruleInfo(alert.ruleId)?.name ?? alert.ruleId}
                          </span>
                          <AttackTechnique ruleId={alert.ruleId} link />
                          <Badge variant={alert.severity}>{alert.severity}</Badge>
                          {alert.count !== undefined && (
                            <span className="font-mono text-[11px] text-text-muted">
                              ×{alert.count}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 break-words font-mono text-[12px] text-text-secondary">
                          {alert.message}
                        </p>
                      </div>
                      <span className="shrink-0 font-mono text-[11px] tabular-nums text-text-muted">
                        {formatDateTime(alert.timestamp)}
                      </span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        <div className="space-y-5">
          <motion.div {...fadeIn(0.08)}>
            {role === 'viewer' ? (
              <ReadOnlyActions incident={incident} />
            ) : (
              <IncidentActions incident={incident} />
            )}
          </motion.div>
          {reputation && (
            <motion.div {...fadeIn(0.14)}>
              <ThreatIntelCard reputation={reputation} />
            </motion.div>
          )}
          <motion.div {...fadeIn(0.2)}>
            <Card>
              <CardHeader>
                <CardTitle>Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <AuditTrail entries={activity} nameOf={nameOf} empty="Nobody has triaged it yet." />
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </main>
  );
}
