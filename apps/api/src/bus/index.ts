import { EventEmitter } from 'node:events';
import type { Alert } from '@argus/contracts';

interface BusEvents {
  'alert.created': [Alert];
}

// in-process pub/sub for module decoupling. For now
// realtime listens straight to 'alert.created' from detection. Once the
// incident engine exists it'll sit in between, and realtime
// will listen to 'incident.created'/'incident.updated' instead.
export type Bus = EventEmitter<BusEvents>;

export function createBus(): Bus {
  return new EventEmitter<BusEvents>();
}
