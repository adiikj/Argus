import { SEVERITY_RANK, type Incident } from '@argus/contracts';

export const RESUMMARIZE_ALERT_DELTA = 3;

export interface SummarizedState {
  severity: Incident['severity'];
  alertCount: number;
}

export function shouldResummarize(prev: SummarizedState | undefined, incident: Incident): boolean {
  if (!prev) return true;
  if (SEVERITY_RANK[incident.severity] > SEVERITY_RANK[prev.severity]) return true;
  return incident.alertIds.length - prev.alertCount >= RESUMMARIZE_ALERT_DELTA;
}
