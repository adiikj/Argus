import type { RawLog, NormalizedEvent } from '@argus/contracts';

// nginx combined access log:
// {ip} - - [{time}] "{method} {path} HTTP/1.1" {status} {bytes} "{referer}" "{ua}"
const NGINX_PATTERN = /^(\S+) - \S+ \[[^\]]+\] "(\S+) (\S+) [^"]*" (\d{3}) \d+ "[^"]*" "([^"]*)"$/;

export function parseNginxLog(rawLog: RawLog): NormalizedEvent | undefined {
  const match = NGINX_PATTERN.exec(rawLog.message);
  if (!match) return undefined;

  const [, sourceIp, method, path, status, userAgent] = match;
  if (!sourceIp || !method || !path || !status) return undefined;

  const statusCode = Number(status);
  return {
    eventId: rawLog.eventId,
    timestamp: rawLog.timestamp,
    source: rawLog.source,
    sourceIp,
    outcome: statusCode < 400 ? 'success' : 'failure',
    method,
    path,
    statusCode,
    userAgent,
    raw: rawLog.message,
  };
}
