import { loadConfig } from '@argus/config';
import { createLogger } from '@argus/logger';
import { RawLog, NormalizedEvent, Alert } from '@argus/contracts';
import {
  createKafkaClient,
  ensureTopics,
  createProducer,
  subscribe,
  TOPICS,
} from './streaming/index.js';
import { parseRawLog } from './parser/index.js';
import { createEsClient, ensureEventsIndex, indexEvent } from './storage/index.js';
import { createRuleEngine, RULES, SeenEventIds } from './detection/index.js';
import { createBus } from './bus/index.js';
import { createRealtimeServer } from './realtime/index.js';

const config = loadConfig();
const log = createLogger({ name: 'api', level: config.LOG_LEVEL });

log.info(
  { storageProfile: config.STORAGE_PROFILE, llmProvider: config.LLM_PROVIDER },
  'api starting',
);

const kafka = createKafkaClient(config);
await ensureTopics(kafka);

const esClient = createEsClient(config);
await ensureEventsIndex(esClient);

const eventsProducer = await createProducer(kafka);

// parser: raw.logs -> validate -> normalize -> events.normalized
await subscribe(kafka, 'api-parser', TOPICS.RAW_LOGS, async (value) => {
  const rawLog = RawLog.parse(value);
  const normalized = parseRawLog(rawLog);
  if (!normalized) {
    log.warn({ rawLog }, 'no parser matched raw log, skipping');
    return;
  }
  await eventsProducer.send(TOPICS.EVENTS_NORMALIZED, normalized.sourceIp, normalized);
});

// storage: events.normalized -> Elasticsearch (independent of detection)
await subscribe(kafka, 'api-es-writer', TOPICS.EVENTS_NORMALIZED, async (value) => {
  const event = NormalizedEvent.parse(value);
  await indexEvent(esClient, event);
  log.info({ eventId: event.eventId }, 'indexed normalized event');
});

// detection: events.normalized -> rule engine -> alerts (independent of storage)
const seenEventIds = new SeenEventIds(5 * 60 * 1000);
const ruleEngine = createRuleEngine(RULES);
await subscribe(kafka, 'api-detection', TOPICS.EVENTS_NORMALIZED, async (value) => {
  const event = NormalizedEvent.parse(value);
  if (seenEventIds.hasSeen(event.eventId)) return; // at-least-once redelivery guard, §4

  for (const alert of ruleEngine.evaluate(event)) {
    await eventsProducer.send(TOPICS.ALERTS, alert.entity, alert);
    log.info({ alert }, 'rule fired');
  }
});

// realtime: alerts -> internal bus -> WS (independent of storage/detection)
const bus = createBus();
await subscribe(kafka, 'api-realtime', TOPICS.ALERTS, async (value) => {
  bus.emit('alert.created', Alert.parse(value));
});
await createRealtimeServer(bus, config.PORT);
log.info({ port: config.PORT }, 'realtime WS server listening at /ws');

// TODO: composition root — wire incident/ai
