import { EventEmitter } from 'node:events';
import type { Alert, Incident, IncidentSummary, NormalizedEvent } from '@argus/contracts';

export interface IncidentEvent {
  incident: Incident;
  latestAlert: Alert;
}

interface BusEvents {
  'incident.created': [IncidentEvent];
  'incident.updated': [IncidentEvent];
  'summary.ready': [IncidentSummary];
  'event.normalized': [NormalizedEvent];
  'alert.raised': [Alert];
}

export type Bus = EventEmitter<BusEvents>;

export function createBus(): Bus {
  return new EventEmitter<BusEvents>();
}

// tracks which entities are "part of an active story" so the live pipeline
// view only gets normalized-event traffic for entities a rule has actually
// fired on recently, instead of every background benign event too.
export class HotEntities {
  private readonly hotUntil = new Map<string, number>();

  constructor(private readonly ttlMs: number) {}

  markHot(entity: string, now: number = Date.now()): void {
    this.hotUntil.set(entity, now + this.ttlMs);
  }

  isHot(entity: string, now: number = Date.now()): boolean {
    const expiresAt = this.hotUntil.get(entity);
    if (expiresAt === undefined) return false;
    if (expiresAt < now) {
      this.hotUntil.delete(entity);
      return false;
    }
    return true;
  }
}
