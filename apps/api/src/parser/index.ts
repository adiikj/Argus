import type { RawLog, NormalizedEvent } from '@argus/contracts';
import { parseAuthLog } from './auth.js';
import { parseNginxLog } from './nginx.js';
import { parseApiGatewayLog } from './api-gateway.js';
import { parseArgusLog } from './argus.js';

// one parser per source; the normalized shape they all return is the single
// contract every downstream module reads (architecture §5).
export function parseRawLog(rawLog: RawLog): NormalizedEvent | undefined {
  switch (rawLog.source) {
    case 'auth':
      return parseAuthLog(rawLog);
    case 'nginx':
      return parseNginxLog(rawLog);
    case 'api-gateway':
      return parseApiGatewayLog(rawLog);
    case 'argus':
      return parseArgusLog(rawLog);
    default:
      return undefined;
  }
}
