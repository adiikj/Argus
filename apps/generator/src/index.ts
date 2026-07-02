import { randomUUID } from 'node:crypto';
import { loadConfig } from '@argus/config';
import { createLogger } from '@argus/logger';
import { RawLog } from '@argus/contracts';
import { createRawLogProducer } from './kafka.js';

const config = loadConfig();
const log = createLogger({ name: 'generator', level: config.LOG_LEVEL });

log.info({ demoMode: config.DEMO_MODE }, 'generator starting');

const USERS = ['admin', 'root', 'deploy', 'jsmith', 'svc-backup'];
const EMIT_INTERVAL_MS = 1500;

function randomIp(): string {
  return `203.0.113.${1 + Math.floor(Math.random() * 254)}`;
}

// one auth-log type for the walking skeleton a plausible
// SSH auth line, mostly benign with occasional failures.
function emitAuthLog(): RawLog {
  const user = USERS[Math.floor(Math.random() * USERS.length)];
  const ip = randomIp();
  const port = 1024 + Math.floor(Math.random() * 60000);
  const failed = Math.random() < 0.2;

  const message = failed
    ? `Failed password for ${user} from ${ip} port ${port} ssh2`
    : `Accepted password for ${user} from ${ip} port ${port} ssh2`;

  return RawLog.parse({
    eventId: randomUUID(),
    timestamp: new Date().toISOString(),
    source: 'auth',
    message,
  });
}

const producer = await createRawLogProducer(config);

setInterval(() => {
  const rawLog = emitAuthLog();
  producer
    .send(rawLog.eventId, rawLog)
    .then(() => log.info({ rawLog }, 'emitted raw log'))
    .catch((err: unknown) => log.error({ err }, 'failed to emit raw log'));
}, EMIT_INTERVAL_MS);
