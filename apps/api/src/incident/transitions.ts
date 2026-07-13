import type { IncidentStatus } from '@argus/contracts';

// a fixed transition table, not a general graph: open is the entry point,
// resolved/false_positive are terminal except for reopening back to open.
const TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
  open: ['acknowledged', 'resolved', 'false_positive'],
  acknowledged: ['resolved', 'false_positive', 'open'],
  resolved: ['open'],
  false_positive: ['open'],
};

export function canTransition(from: IncidentStatus, to: IncidentStatus): boolean {
  return TRANSITIONS[from].includes(to);
}
