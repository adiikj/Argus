import { loadConfig } from '@argus/config';
import { createLogger } from '@argus/logger';
import { RawLog, NormalizedEvent, Alert } from '@argus/contracts';
import type { Kafka } from 'kafkajs';
import { createClient } from 'redis';
import {
  createKafkaClient,
  ensureTopics,
  createProducer,
  subscribe,
  TOPICS,
  type StreamProducer,
} from './streaming/index.js';
import { parseRawLog } from './parser/index.js';
import {
  createEsClient,
  createElasticEventStore,
  createPostgresEventStore,
  type EventStore,
} from './storage/index.js';
import {
  createRuleEngine,
  RULES,
  SeenEventIds,
  InMemoryWindowStore,
  RedisWindowStore,
  InMemoryBaselineStore,
  RedisBaselineStore,
  type WindowStore,
  type BaselineStore,
} from './detection/index.js';
import { createBus, RedisBus, HotEntities, type Bus } from './bus/index.js';
import { createRealtimeServer } from './realtime/index.js';
import { createMetrics, type Metrics } from './metrics/index.js';
import {
  createPrismaClient,
  attachAlert,
  getIncidentDetail,
  getAlertsAndIncidentsForEvent,
  CORRELATION_WINDOW_MS,
  type PrismaClient,
} from './incident/index.js';
import { selectProvider, startAiEngine } from './ai/index.js';
import { getSystemHealth } from './system/index.js';
import { createAuthService, type AuthService } from './auth/index.js';

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

// storage: events.normalized -> the event store (Elasticsearch, or Postgres
// under STORAGE_PROFILE=lite — independent of detection, §4). Also feeds the
// live pipeline view: only broadcasts for entities a rule has actually fired
// on recently, so background noise doesn't flood the socket.
async function startStorage(
  kafka: Kafka,
  eventStore: EventStore,
  bus: Bus,
  hotEntities: HotEntities,
  m: Metrics,
): Promise<void> {
  await subscribe(kafka, 'api-es-writer', TOPICS.EVENTS_NORMALIZED, async (value) => {
    const event = NormalizedEvent.parse(value);
    await eventStore.index(event);
    m.incr('eventsIndexed');
    log.debug({ eventId: event.eventId }, 'indexed normalized event');
    if (hotEntities.isHot(event.sourceIp)) bus.emit('event.normalized', event);
  });
}

// detection: events.normalized -> rule engine -> alerts (independent of storage, §4)
async function startDetection(
  kafka: Kafka,
  producer: StreamProducer,
  bus: Bus,
  hotEntities: HotEntities,
  windowStore: WindowStore,
  baselineStore: BaselineStore,
  m: Metrics,
): Promise<void> {
  const seenEventIds = new SeenEventIds(5 * 60 * 1000);
  const ruleEngine = createRuleEngine(RULES, windowStore, baselineStore);
  await subscribe(kafka, 'api-detection', TOPICS.EVENTS_NORMALIZED, async (value) => {
    const event = NormalizedEvent.parse(value);
    if (seenEventIds.hasSeen(event.eventId)) return; // at-least-once redelivery guard, §4

    for (const alert of await ruleEngine.evaluate(event)) {
      await producer.send(TOPICS.ALERTS, alert.entity, alert);
      m.incr('alertsRaised');
      hotEntities.markHot(alert.entity);
      bus.emit('alert.raised', alert);
      log.info({ alert }, 'rule fired');
    }
  });
}

// incident: alerts -> correlate into Postgres incidents -> internal bus (§7)
async function startIncident(
  kafka: Kafka,
  prisma: PrismaClient,
  bus: Bus,
  m: Metrics,
): Promise<void> {
  await subscribe(kafka, 'api-incident', TOPICS.ALERTS, async (value) => {
    const alert = Alert.parse(value);
    const { incident, isNew } = await attachAlert(prisma, alert);
    m.incr(isNew ? 'incidentsOpened' : 'incidentsUpdated');
    bus.emit(isNew ? 'incident.created' : 'incident.updated', { incident, latestAlert: alert });
    log.info(
      { incidentId: incident.incidentId, isNew, ruleId: alert.ruleId },
      isNew ? 'incident opened' : 'incident updated',
    );
  });
}

// realtime: internal bus -> WS (independent of storage/detection, §4/§9).
// Listens to the bus, not Kafka directly — the incident engine is the one
// Kafka consumer on `alerts`, per §7's wiring.
async function startRealtime(
  kafka: Kafka,
  bus: Bus,
  prisma: PrismaClient,
  eventStore: EventStore,
  m: Metrics,
  auth: AuthService,
): Promise<void> {
  await createRealtimeServer(bus, config.PORT, {
    getMetrics: () => m.snapshot(),
    getIncidentDetail: (id) => getIncidentDetail(prisma, id),
    searchEvents: (params) => eventStore.search(params),
    getEventTrace: async (eventId) => {
      const [event, { alerts, incidents }] = await Promise.all([
        eventStore.getById(eventId),
        getAlertsAndIncidentsForEvent(prisma, eventId),
      ]);
      return { eventId, event, alerts, incidents };
    },
    getSystemHealth: () => getSystemHealth(kafka, prisma, eventStore),
    auth,
    corsOrigin: config.CORS_ORIGIN,
  });
  log.info({ port: config.PORT }, 'realtime WS + REST (incidents, events, trace) listening');
}

// ai: incident.created/updated -> LLMProvider (or template fallback) -> summaries, on the bus (§8)
function startAi(prisma: PrismaClient, bus: Bus, m: Metrics): void {
  const provider = selectProvider(config);
  startAiEngine({ prisma, bus, provider, log });
  bus.on('summary.ready', () => m.incr('summariesGenerated'));
  log.info({ provider: provider.name }, 'ai summarization engine started');
}

const kafka = createKafkaClient(config);
await ensureTopics(kafka);

const prisma = createPrismaClient(config);

// STORAGE_PROFILE=full backs the event store with Elasticsearch (default);
// =lite uses Postgres FTS instead and never touches ES at all — no client,
// no index to ensure.
const eventStore: EventStore =
  config.STORAGE_PROFILE === 'lite'
    ? createPostgresEventStore(prisma)
    : createElasticEventStore(createEsClient(config));
await eventStore.ensure();

const producer = await createProducer(kafka);
const hotEntities = new HotEntities(CORRELATION_WINDOW_MS);

// no REDIS_URL -> everything stays in-process (single instance, no extra
// infra); set it to back the window store, baseline store, and bus with
// Redis instead, so detection state and event fanout survive across more
// than one api process.
let bus: Bus;
let windowStore: WindowStore;
let baselineStore: BaselineStore;
if (config.REDIS_URL) {
  const redisClient = createClient({ url: config.REDIS_URL });
  const redisSubscriber = redisClient.duplicate();
  await Promise.all([redisClient.connect(), redisSubscriber.connect()]);
  windowStore = new RedisWindowStore(redisClient);
  baselineStore = new RedisBaselineStore(redisClient);
  bus = await RedisBus.create(redisClient, redisSubscriber);
  log.info({ redisUrl: config.REDIS_URL }, 'using Redis-backed window store, baseline store + bus');
} else {
  windowStore = new InMemoryWindowStore();
  baselineStore = new InMemoryBaselineStore();
  bus = createBus();
  log.info('using in-memory window/baseline stores + local bus (set REDIS_URL to distribute them)');
}

await startParser(kafka, producer, metrics);
await startStorage(kafka, eventStore, bus, hotEntities, metrics);
await startDetection(kafka, producer, bus, hotEntities, windowStore, baselineStore, metrics);
await startIncident(kafka, prisma, bus, metrics);
const authService = await createAuthService(prisma, {
  authSecret: config.AUTH_SECRET,
  googleClientId: config.GOOGLE_CLIENT_ID,
});

await startRealtime(kafka, bus, prisma, eventStore, metrics, authService);
startAi(prisma, bus, metrics);
