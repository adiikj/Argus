import type { RawLog, NormalizedEvent } from '@argus/contracts';
import { parseAuthLog } from './auth.js';

// walking skeleton: only `auth` is implemented so far
export function parseRawLog(rawLog: RawLog): NormalizedEvent | undefined {
  switch (rawLog.source) {
    case 'auth':
      return parseAuthLog(rawLog);
    default:
      return undefined;
  }
}
