import { loadConfig } from '@argus/config';
import { createLogger } from '@argus/logger';

const config = loadConfig();
const log = createLogger({ name: 'generator', level: config.LOG_LEVEL });

log.info({ demoMode: config.DEMO_MODE }, 'generator starting');

// TODO: scenario-driven emission to raw.logs + background noise + POST /simulate/:scenario
