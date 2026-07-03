import { randomUUID } from 'node:crypto';
import { loadConfig } from '@argus/config';
import { RawLog, NormalizedEvent } from '@argus/contracts';
import { Client } from '@elastic/elasticsearch';
import { createKafkaClient, ensureTopics, createProducer, TOPICS } from '../src/streaming/index.js';
import { EVENTS_INDEX } from '../src/storage/index.js';

const TIMEOUT_MS = 20_000;
const POLL_INTERVAL_MS = 500;

async function main(): Promise<void> {
  const config = loadConfig();
  const eventId = randomUUID();

  const rawLog = RawLog.parse({
    eventId,
    timestamp: new Date().toISOString(),
    source: 'auth',
    message: 'Failed password for smoketest from 203.0.113.99 port 51234 ssh2',
  });

  const kafka = createKafkaClient(config);
  await ensureTopics(kafka);
  const producer = await createProducer(kafka);

  console.log(`[smoke] publishing raw log ${eventId} to ${TOPICS.RAW_LOGS}`);
  await producer.send(TOPICS.RAW_LOGS, eventId, rawLog);
  await producer.disconnect();

  const esClient = new Client({ node: config.ES_NODE });
  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    const result = await esClient.search({
      index: EVENTS_INDEX,
      query: { ids: { values: [eventId] } },
      size: 1,
    });
    const hit = result.hits.hits[0];
    if (hit?._source) {
      const event = NormalizedEvent.parse(hit._source);
      if (event.sourceIp === '203.0.113.99' && event.outcome === 'failure') {
        console.log('[smoke] PASS — raw log made it through parse -> store');
        return;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error(
    `event ${eventId} never appeared in Elasticsearch within ${TIMEOUT_MS}ms — ` +
      'is the api running (pnpm --filter @argus/api dev) and infra up (pnpm infra:up)?',
  );
}

main().catch((err: unknown) => {
  console.error('[smoke] FAIL —', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
