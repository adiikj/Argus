import { setTimeout as sleep } from 'node:timers/promises';
import { loadConfig } from '@argus/config';
import { createLogger } from '@argus/logger';
import type { RawLog } from '@argus/contracts';
import { createRawLogProducer } from './kafka.js';
import { benignEvent, SCENARIOS, SCENARIO_NAMES } from './scenarios.js';
import { createSimulatorServer } from './server.js';

const config = loadConfig();
const log = createLogger({ name: 'generator', level: config.LOG_LEVEL });

log.info({ demoMode: config.DEMO_MODE }, 'generator starting');

const NOISE_INTERVAL_MS = 1200; // background benign traffic cadence (§15 layer 1)
const BURST_STAGGER_MS = 120; // space injected attack logs so the UI streams them

const producer = await createRawLogProducer(config);

async function emit(raw: RawLog): Promise<void> {
  await producer.send(raw.eventId, raw);
  log.debug({ eventId: raw.eventId, source: raw.source }, 'emitted raw log');
}

// fire one scenario's burst, staggered so a viewer watches it stream in
async function runScenario(name: string): Promise<number> {
  const scenario = SCENARIOS[name];
  if (!scenario) throw new Error(`unknown scenario: ${name}`);
  const logs = scenario.generate();
  for (const raw of logs) {
    await emit(raw);
    await sleep(BURST_STAGGER_MS);
  }
  return logs.length;
}

// layer 1: always-on benign noise, so the dashboard is never empty
setInterval(() => {
  emit(benignEvent()).catch((err: unknown) => log.error({ err }, 'failed to emit noise'));
}, NOISE_INTERVAL_MS);

// layer 2: the /simulate trigger API
await createSimulatorServer({ port: config.GENERATOR_PORT, log, runScenario });
log.info({ port: config.GENERATOR_PORT, scenarios: SCENARIO_NAMES }, 'simulator API listening');

// the lazy path: a scripted timeline shortly after boot, so an unattended
// `docker compose up` still shows alerts/incidents within ~30s (§15).
if (config.DEMO_MODE) {
  const timeline = ['brute-force', 'dir-enum', 'sqli', 'rate-abuse', 'invalid-jwt'];
  void (async () => {
    await sleep(8_000);
    for (const scenario of timeline) {
      log.info({ scenario }, 'demo timeline: firing scenario');
      await runScenario(scenario).catch((err: unknown) =>
        log.error({ err }, 'demo scenario failed'),
      );
      await sleep(12_000);
    }
  })();
}
