'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { IncidentStatus } from '@argus/contracts';
import { ruleInfo } from '@argus/contracts/rules';
import { useRealtime } from '@/lib/realtime';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { AttackTechnique } from '../_components/attack-technique';
import { PageHeader } from '../_components/page-header';

type Tab = IncidentStatus | 'all';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'open', label: 'Open' },
  { id: 'acknowledged', label: 'Acknowledged' },
  { id: 'resolved', label: 'Resolved' },
  { id: 'false_positive', label: 'False positive' },
  { id: 'all', label: 'All' },
];

const STATUS_STYLE: Record<IncidentStatus, string> = {
  open: 'text-severity-critical',
  acknowledged: 'text-severity-medium',
  resolved: 'text-severity-ok',
  false_positive: 'text-text-muted',
};

function ago(iso: string): string {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86_400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86_400)}d ago`;
}

export default function IncidentsPage() {
  const { incidents } = useRealtime();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('open');

  const counts = useMemo(() => {
    const c: Record<Tab, number> = {
      all: incidents.length,
      open: 0,
      acknowledged: 0,
      resolved: 0,
      false_positive: 0,
    };
    for (const { incident } of incidents) c[incident.status] += 1;
    return c;
  }, [incidents]);

  const rows = tab === 'all' ? incidents : incidents.filter((r) => r.incident.status === tab);

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Incidents"
        description="Alerts correlated per source into incidents. Triage them here — acknowledge, resolve with a note, or mark a false positive."
      />

      <div className="mb-4 flex flex-wrap gap-1 rounded-xl border border-border-subtle bg-bg-panel/60 p-1 sm:inline-flex">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'flex items-center gap-2 rounded-lg px-3 py-1.5 text-[12.5px] transition-colors',
              tab === t.id
                ? 'bg-bg-elevated text-text-primary shadow-[inset_0_1px_0_rgb(255_255_255/0.05)]'
                : 'text-text-secondary hover:text-text-primary',
            )}
          >
            {t.label}
            <span className="font-mono text-[11px] text-text-muted">{counts[t.id]}</span>
          </button>
        ))}
      </div>

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <div className="py-24 text-center text-sm text-text-muted">
            {incidents.length === 0 ? (
              <>
                No incidents yet.{' '}
                <Link href="/simulator" className="text-accent hover:underline">
                  Fire one from the simulator →
                </Link>
              </>
            ) : (
              'Nothing in this state.'
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left">
              <thead>
                <tr className="border-b border-border-subtle font-mono text-[10.5px] uppercase tracking-[0.12em] text-text-muted">
                  <th className="px-5 py-3 font-medium">Severity</th>
                  <th className="px-3 py-3 font-medium">Source</th>
                  <th className="px-3 py-3 font-medium">Latest detection</th>
                  <th className="px-3 py-3 text-right font-medium">Alerts</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 text-right font-medium">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {rows.map(({ incident, latestAlert, geo }) => (
                  <tr
                    key={incident.incidentId}
                    onClick={() => router.push(`/incidents/${incident.incidentId}`)}
                    className="cursor-pointer transition-colors hover:bg-bg-elevated/60"
                  >
                    <td className="px-5 py-3">
                      <Badge variant={incident.severity}>{incident.severity}</Badge>
                    </td>
                    <td className="px-3 py-3">
                      <Link
                        href={`/incidents/${incident.incidentId}`}
                        className="font-mono text-[13px] text-text-primary hover:text-accent"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {incident.correlationKey}
                      </Link>
                      <div className="font-mono text-[10.5px] text-text-muted">
                        {geo
                          ? `${geo.countryName}${geo.source === 'simulated' ? ' · simulated' : ''}`
                          : '—'}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] text-text-primary">
                          {ruleInfo(latestAlert.ruleId)?.name ?? latestAlert.ruleId}
                        </span>
                        <AttackTechnique ruleId={latestAlert.ruleId} />
                      </div>
                      <div className="max-w-[420px] truncate text-[11.5px] text-text-muted">
                        {latestAlert.message}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-[13px] tabular-nums text-text-secondary">
                      {incident.alertIds.length}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={cn(
                          'font-mono text-[11px] uppercase',
                          STATUS_STYLE[incident.status],
                        )}
                      >
                        {incident.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-[11.5px] text-text-muted">
                      {ago(incident.updatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </main>
  );
}
