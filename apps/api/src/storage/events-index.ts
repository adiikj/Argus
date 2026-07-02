import type { Client } from '@elastic/elasticsearch';
import type { NormalizedEvent } from '@argus/contracts';

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
