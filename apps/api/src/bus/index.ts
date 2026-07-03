import { EventEmitter } from 'node:events';
import type { Alert, Incident, IncidentSummary } from '@argus/contracts';

export interface IncidentEvent {
  incident: Incident;
  latestAlert: Alert;
}

interface BusEvents {
  'incident.created': [IncidentEvent];
  'incident.updated': [IncidentEvent];
  'summary.ready': [IncidentSummary];
}

export type Bus = EventEmitter<BusEvents>;

export function createBus(): Bus {
  return new EventEmitter<BusEvents>();
}
