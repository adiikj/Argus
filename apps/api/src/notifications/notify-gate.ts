import type { Incident } from '@argus/contracts';

const NOTIFY_THRESHOLD: Incident['severity'][] = ['high', 'critical'];

export interface NotifiedState {
  notifiedAt: number;
}

// pure: mirrors ai/resummarize.ts's shouldResummarize shape. Exactly one
// notification per incident, ever — once notified, further updates (more
// alerts, a status change) never re-trigger it.
export function shouldNotify(prev: NotifiedState | undefined, incident: Incident): boolean {
  if (!NOTIFY_THRESHOLD.includes(incident.severity)) return false;
  return !prev;
}
