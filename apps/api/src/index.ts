import { loadConfig } from '@argus/config';
import { createLogger } from '@argus/logger';

const config = loadConfig();
const log = createLogger({ name: 'api', level: config.LOG_LEVEL });

log.info(
  { storageProfile: config.STORAGE_PROFILE, llmProvider: config.LLM_PROVIDER },
  'api starting',
);

// TODO: composition root — wire streaming/parser/storage/detection/incident/ai/realtime
