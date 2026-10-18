import { z } from 'zod';
import type { RawLog, NormalizedEvent } from '@argus/contracts';

// the api's own security events (apps/api/src/selfmon), one JSON object per
// line, the same shape as the api-gateway lines plus outcome and reason
const ArgusLine = z.object({
  ip: z.string().ip(),
  method: z.string(),
  path: z.string(),
  status: z.number().int(),
  outcome: z.enum(['success', 'failure']),
  reason: z.string(),
  user: z.string().optional(),
  userAgent: z.string().optional(),
});

export function parseArgusLog(rawLog: RawLog): NormalizedEvent | undefined {
  let json: unknown;
  try {
    json = JSON.parse(rawLog.message);
  } catch {
    return undefined;
  }
  const parsed = ArgusLine.safeParse(json);
  if (!parsed.success) return undefined;
  const line = parsed.data;

  return {
    eventId: rawLog.eventId,
    timestamp: rawLog.timestamp,
    source: rawLog.source,
    sourceIp: line.ip,
    outcome: line.outcome,
    username: line.user,
    method: line.method,
    path: line.path,
    statusCode: line.status,
    userAgent: line.userAgent,
    raw: rawLog.message,
  };
}
