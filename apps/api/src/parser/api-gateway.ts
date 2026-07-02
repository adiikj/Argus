import { z } from 'zod';
import type { RawLog, NormalizedEvent } from '@argus/contracts';

// api-gateway emits structured JSON (unlike auth/nginx text) — parse then
// validate the shape before trusting it.
const ApiGatewayLine = z.object({
  ip: z.string().ip(),
  method: z.string(),
  path: z.string(),
  status: z.number().int(),
  userAgent: z.string().optional(),
  user: z.string().optional(),
});

export function parseApiGatewayLog(rawLog: RawLog): NormalizedEvent | undefined {
  let json: unknown;
  try {
    json = JSON.parse(rawLog.message);
  } catch {
    return undefined;
  }

  const parsed = ApiGatewayLine.safeParse(json);
  if (!parsed.success) return undefined;
  const line = parsed.data;

  return {
    eventId: rawLog.eventId,
    timestamp: rawLog.timestamp,
    source: rawLog.source,
    sourceIp: line.ip,
    outcome: line.status < 400 ? 'success' : 'failure',
    username: line.user,
    method: line.method,
    path: line.path,
    statusCode: line.status,
    userAgent: line.userAgent,
    raw: rawLog.message,
  };
}
