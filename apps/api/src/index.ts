import { loadConfig } from '@argus/config';
import { createLogger } from '@argus/logger';
import { RawLog, NormalizedEvent, Alert } from '@argus/contracts';
import type { Kafka } from 'kafkajs';
import {
  createKafkaClient,
  ensureTopics,
  createProducer,
  subscribe,
  TOPICS,
  type StreamProducer,
} from './streaming/index.js';
import { parseRawLog } from './parser/index.js';
import { createEsClient, ensureEventsIndex, indexEvent } from './storage/index.js';
import { createRuleEngine, RULES, SeenEventIds } from './detection/index.js';
import { createBus } from './bus/index.js';
import { createRealtimeServer } from './realtime/index.js';
import { createMetrics, type Metrics } from './metrics/index.js';

const config = loadConfig();
const log = createLogger({ name: 'api', level: config.LOG_LEVEL });
const metrics = createMetrics();

log.info(
  { storageProfile: config.STORAGE_PROFILE, llmProvider: config.LLM_PROVIDER },
  'api starting',
);

// parser: raw.logs -> validate -> normalize -> events.normalized
async function startParser(kafka: Kafka, producer: StreamProducer, m: Metrics): Promise<void> {
  await subscribe(kafka, 'api-parser', TOPICS.RAW_LOGS, async (value) => {
    m.incr('rawLogsConsumed');
    const rawLog = RawLog.parse(value);
    const normalized = parseRawLog(rawLog);
    if (!normalized) {
      m.incr('parseFailures');
      log.warn({ rawLog }, 'no parser matched raw log, skipping');
      return;
    }
    m.incr('eventsNormalized');
    await producer.send(TOPICS.EVENTS_NORMALIZED, normalized.sourceIp, normalized);
  });
}

// storage: events.normalized -> Elasticsearch (independent of detection, §4)
async function startStorage(
  kafka: Kafka,
  esClient: ReturnType<typeof createEsClient>,
  m: Metrics,
): Promise<void> {
  await subscribe(kafka, 'api-es-writer', TOPICS.EVENTS_NORMALIZED, async (value) => {
    const event = NormalizedEvent.parse(value);
    await indexEvent(esClient, event);
    m.incr('eventsIndexed');
    log.debug({ eventId: event.eventId }, 'indexed normalized event');
  });
}

// detection: events.normalized -> rule engine -> alerts (independent of storage, §4)
async function startDetection(kafka: Kafka, producer: StreamProducer, m: Metrics): Promise<void> {
  const seenEventIds = new SeenEventIds(5 * 60 * 1000);
  const ruleEngine = createRuleEngine(RULES);
  await subscribe(kafka, 'api-detection', TOPICS.EVENTS_NORMALIZED, async (value) => {
    const event = NormalizedEvent.parse(value);
    if (seenEventIds.hasSeen(event.eventId)) return; // at-least-once redelivery guard, §4

    for (const alert of ruleEngine.evaluate(event)) {
      await producer.send(TOPICS.ALERTS, alert.entity, alert);
      m.incr('alertsRaised');
      log.info({ alert }, 'rule fired');
    }
  });
}

// realtime: alerts -> internal bus -> WS (independent of storage/detection, §4/§9)
async function startRealtime(kafka: Kafka, m: Metrics): Promise<void> {
  const bus = createBus();
  await subscribe(kafka, 'api-realtime', TOPICS.ALERTS, async (value) => {
    bus.emit('alert.created', Alert.parse(value));
  });
  await createRealtimeServer(bus, config.PORT, { getMetrics: () => m.snapshot() });
  log.info({ port: config.PORT }, 'realtime WS + /healthz + /metrics listening');
}

const kafka = createKafkaClient(config);
await ensureTopics(kafka);

const esClient = createEsClient(config);
await ensureEventsIndex(esClient);

const producer = await createProducer(kafka);

await startParser(kafka, producer, metrics);
await startStorage(kafka, esClient, metrics);
await startDetection(kafka, producer, metrics);
await startRealtime(kafka, metrics);

// TODO: composition root — wire incident/ai (Day 7/8)
