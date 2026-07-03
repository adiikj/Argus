import type { Client } from '@elastic/elasticsearch';
import { NormalizedEvent } from '@argus/contracts';

export const EVENTS_INDEX = 'normalized-events';

export async function ensureEventsIndex(client: Client): Promise<void> {
  const exists = await client.indices.exists({ index: EVENTS_INDEX });
  if (exists) return;

  await client.indices.create({
    index: EVENTS_INDEX,
    mappings: {
      properties: {
        eventId: { type: 'keyword' },
        timestamp: { type: 'date' },
        source: { type: 'keyword' },
        sourceIp: { type: 'ip' },
        outcome: { type: 'keyword' },
        username: { type: 'keyword' },
        method: { type: 'keyword' },
        path: { type: 'keyword' },
        statusCode: { type: 'integer' },
        userAgent: { type: 'text' },
        raw: { type: 'text' },
      },
    },
  });
}

export async function indexEvent(client: Client, event: NormalizedEvent): Promise<void> {
  await client.index({
    index: EVENTS_INDEX,
    id: event.eventId,
    document: event,
  });
}

export async function getEventById(
  client: Client,
  eventId: string,
): Promise<NormalizedEvent | undefined> {
  const result = await client.search({
    index: EVENTS_INDEX,
    query: { ids: { values: [eventId] } },
    size: 1,
  });
  const hit = result.hits.hits[0];
  return hit?._source ? NormalizedEvent.parse(hit._source) : undefined;
}

export interface EventSearchParams {
  q?: string;
  source?: string;
  limit?: number;
}

export async function searchEvents(
  client: Client,
  params: EventSearchParams = {},
): Promise<NormalizedEvent[]> {
  const must = [];
  if (params.q) {
    must.push({
      multi_match: {
        query: params.q,
        fields: ['raw', 'sourceIp', 'username', 'path', 'userAgent'],
        lenient: true,
      },
    });
  }
  if (params.source) {
    must.push({ term: { source: params.source } });
  }

  const result = await client.search({
    index: EVENTS_INDEX,
    size: params.limit ?? 50,
    sort: [{ timestamp: { order: 'desc' } }],
    query: must.length > 0 ? { bool: { must } } : { match_all: {} },
  });

  return result.hits.hits.flatMap((hit) =>
    hit._source ? [NormalizedEvent.parse(hit._source)] : [],
  );
}
