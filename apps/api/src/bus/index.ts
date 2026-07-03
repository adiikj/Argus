import { EventEmitter } from 'node:events';
import type { Alert, Incident } from '@argus/contracts';

// payload for both incident bus events: the incident's current state plus
// whichever alert just caused this update, so subscribers (realtime, and
// later ai) don't have to re-derive "what changed" themselves.
export interface IncidentEvent {
  incident: Incident;
  latestAlert: Alert;
}

interface BusEvents {
  'incident.created': [IncidentEvent];
  'incident.updated': [IncidentEvent];
}

// in-process pub/sub for module decoupling. The incident engine (§7) is the
// only publisher; realtime (§9) and, later, ai (§8) are the subscribers —
// neither imports the other directly.
export type Bus = EventEmitter<BusEvents>;

export function createBus(): Bus {
  return new EventEmitter<BusEvents>();
}
