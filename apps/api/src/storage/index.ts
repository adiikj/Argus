import type { Client } from '@elastic/elasticsearch';
import type { NormalizedEvent } from '@argus/contracts';
import type { PrismaClient } from '../incident/index.js';
import {
  ensureEventsIndex,
  indexEvent,
  getEventById,
  searchEvents,
  type EventSearchParams,
} from './events-index.js';
import {
  indexEventPostgres,
  getEventByIdPostgres,
  searchEventsPostgres,
} from './postgres-events.js';

export { createEsClient } from './es-client.js';
export {
  ensureEventsIndex,
  indexEvent,
  getEventById,
  searchEvents,
  EVENTS_INDEX,
} from './events-index.js';
export type { EventSearchParams } from './events-index.js';

export interface EventStoreHealth {
  ok: boolean;
  status: string | null;
}

// STORAGE_PROFILE=full backs this with Elasticsearch, =lite with Postgres FTS
// (postgres-events.ts) — everything above the abstraction (index.ts wiring,
// the realtime REST routes, system health) only ever talks to this shape.
export interface EventStore {
  readonly backend: 'elasticsearch' | 'postgres';
  ensure(): Promise<void>;
  index(event: NormalizedEvent): Promise<void>;
  getById(eventId: string): Promise<NormalizedEvent | undefined>;
  search(params?: EventSearchParams): Promise<NormalizedEvent[]>;
  checkHealth(): Promise<EventStoreHealth>;
}

export function createElasticEventStore(client: Client): EventStore {
  return {
    backend: 'elasticsearch',
    ensure: () => ensureEventsIndex(client),
    index: (event) => indexEvent(client, event),
    getById: (eventId) => getEventById(client, eventId),
    search: (params) => searchEvents(client, params),
    checkHealth: async () => {
      try {
        const health = await client.cluster.health();
        return { ok: health.status !== 'red', status: health.status };
      } catch {
        return { ok: false, status: null };
      }
    },
  };
}

export function createPostgresEventStore(prisma: PrismaClient): EventStore {
  return {
    backend: 'postgres',
    ensure: () => Promise.resolve(), // table exists via migration, nothing to provision at boot
    index: (event) => indexEventPostgres(prisma, event),
    getById: (eventId) => getEventByIdPostgres(prisma, eventId),
    search: (params) => searchEventsPostgres(prisma, params),
    checkHealth: async () => {
      try {
        await prisma.$queryRaw`SELECT 1 FROM normalized_events LIMIT 1`;
        return { ok: true, status: 'ok' };
      } catch {
        return { ok: false, status: null };
      }
    },
  };
}
