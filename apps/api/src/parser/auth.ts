import type { RawLog, NormalizedEvent } from '@argus/contracts';

// matches what apps/generator emits: "Accepted|Failed password for {user} from {ip} port {port} ssh2"
const SSH_AUTH_PATTERN = /^(Accepted|Failed) password for (\S+) from (\S+) port (\d+) ssh2$/;

export function parseAuthLog(rawLog: RawLog): NormalizedEvent | undefined {
  const match = SSH_AUTH_PATTERN.exec(rawLog.message);
  if (!match) return undefined;

  const [, result, username, sourceIp] = match;
  if (!sourceIp) return undefined;

  return {
    eventId: rawLog.eventId,
    timestamp: rawLog.timestamp,
    source: rawLog.source,
    sourceIp,
    outcome: result === 'Accepted' ? 'success' : 'failure',
    username,
    raw: rawLog.message,
  };
}
