'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import type { Incident, IncidentStatus } from '@argus/contracts';
import { useIncidentDetail } from '@/lib/use-incident-detail';
import { usePatchIncident } from '@/lib/use-incident-mutation';
import { useUsers } from '@/lib/use-users';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { KillChain } from '../../_components/kill-chain';

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

        {incident.resolutionNote && (
          <div>
            <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-text-secondary">
              Resolution note
            </p>
            <p className="text-sm text-text-secondary">{incident.resolutionNote}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
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

      <motion.div className="mb-6" {...fadeIn(0)}>
        <div className="mb-2 flex items-center gap-2">
          <Badge variant={incident.severity}>{incident.severity}</Badge>
          <Badge variant={STATUS_VARIANT[incident.status]}>{incident.status}</Badge>
        </div>
        <h1 className="font-mono text-lg font-semibold text-text-primary">
          {incident.correlationKey}
        </h1>
        <p className="mt-1 text-xs text-text-secondary">
          opened {formatDateTime(incident.createdAt)} · updated {formatDateTime(incident.updatedAt)}
        </p>
      </motion.div>

      <motion.div {...fadeIn(0.08)}>
        <IncidentActions incident={incident} />
      </motion.div>

      <motion.div {...fadeIn(0.16)}>
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
      </motion.div>

      <motion.div {...fadeIn(0.22)}>
        <KillChain alerts={alerts} />
      </motion.div>

      <motion.div {...fadeIn(0.28)}>
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
                    <span className="flex-1 truncate text-sm text-text-primary">
                      {alert.message}
                    </span>
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
      </motion.div>
    </main>
  );
}
