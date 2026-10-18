import Link from 'next/link';
import type { AuditEntry, IncidentStatus } from '@argus/contracts';

const STATUS_NAME: Record<IncidentStatus, string> = {
  open: 'open',
  acknowledged: 'acknowledged',
  resolved: 'resolved',
  false_positive: 'false positive',
};

function statusName(value: string | null): string {
  return value ? (STATUS_NAME[value as IncidentStatus] ?? value) : '-';
}

function ago(iso: string): string {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86_400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86_400)}d ago`;
}

function actorName(entry: AuditEntry): string {
  if (!entry.actor) return 'anonymous';
  if (entry.actor.email) return entry.actor.email;
  const role = entry.actor.role;
  return role === 'admin' ? 'an admin' : role === 'analyst' ? 'an analyst' : 'someone';
}

function Mono({ children }: { children: string }) {
  return <span className="font-mono text-[12px] text-text-primary">{children}</span>;
}

// what happened, as a sentence fragment after the actor's name
function describe(entry: AuditEntry, nameOf: (userId: string) => string, showTarget: boolean) {
  const target =
    showTarget && entry.targetType === 'incident' ? (
      <>
        {' '}
        <Link
          href={`/incidents/${entry.targetId}`}
          className="font-mono text-[12px] text-accent hover:underline"
        >
          {entry.targetId.slice(0, 8)}
        </Link>
      </>
    ) : null;

  switch (entry.action) {
    case 'incident.status':
      return (
        <>
          moved{target ?? ' it'} from <Mono>{statusName(entry.from)}</Mono> to{' '}
          <Mono>{statusName(entry.to)}</Mono>
        </>
      );
    case 'incident.assignee':
      return entry.to ? (
        <>
          assigned{target ?? ' it'} to <Mono>{nameOf(entry.to)}</Mono>
        </>
      ) : (
        <>unassigned{target ?? ' it'}</>
      );
    case 'incident.note':
      return (
        <>
          {entry.from ? 'edited' : 'added'} the resolution note{target && <> on{target}</>}
        </>
      );
    case 'user.role':
      return (
        <>
          changed <Mono>{nameOf(entry.targetId)}</Mono> from <Mono>{entry.from ?? '-'}</Mono> to{' '}
          <Mono>{entry.to ?? '-'}</Mono>
        </>
      );
  }
}

// the audit trail as a vertical list: who did what, when. nameOf maps a
// userId (assignee, role target) to something readable; unknown ids fall
// back to "someone" so a viewer, who can't list accounts, still gets a sentence.
export function AuditTrail({
  entries,
  nameOf,
  showTarget = false,
  empty,
}: {
  entries: AuditEntry[];
  nameOf: (userId: string) => string;
  showTarget?: boolean;
  empty: string;
}) {
  if (entries.length === 0) return <p className="text-sm text-text-muted">{empty}</p>;
  return (
    <ol className="space-y-3">
      {entries.map((entry) => (
        <li key={entry.id} className="flex gap-3 text-[13px] leading-relaxed text-text-secondary">
          <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-border-strong" />
          <div className="min-w-0 flex-1">
            <span className="text-text-primary">{actorName(entry)}</span>{' '}
            {describe(entry, nameOf, showTarget)}
            {entry.action === 'incident.note' && entry.to && (
              <p className="mt-1 border-l-2 border-border-strong pl-2 text-[12px] break-words text-text-muted">
                {entry.to}
              </p>
            )}
          </div>
          <time
            dateTime={entry.at}
            title={new Date(entry.at).toLocaleString(undefined, { hour12: false })}
            className="shrink-0 font-mono text-[11px] text-text-muted tabular-nums"
          >
            {ago(entry.at)}
          </time>
        </li>
      ))}
    </ol>
  );
}
