import { describe, it, expect } from 'vitest';
import type { RawLog } from '@argus/contracts';
import { parseNginxLog } from '../../src/parser/nginx.js';

function raw(message: string): RawLog {
  return {
    eventId: '22222222-2222-4222-8222-222222222222',
    timestamp: '2026-07-02T12:00:00.000Z',
    source: 'nginx',
    message,
  };
}

const LINE_200 =
  '203.0.113.5 - - [02/Jul/2026:12:00:00 +0000] "GET /index.html HTTP/1.1" 200 512 "-" "Mozilla/5.0"';
const LINE_404 =
  '198.51.100.7 - - [02/Jul/2026:12:00:00 +0000] "GET /.env HTTP/1.1" 404 153 "-" "gobuster/3.6"';

describe('parseNginxLog', () => {
  it('extracts method, path, status and user agent', () => {
    expect(parseNginxLog(raw(LINE_200))).toMatchObject({
      sourceIp: '203.0.113.5',
      method: 'GET',
      path: '/index.html',
      statusCode: 200,
      userAgent: 'Mozilla/5.0',
      outcome: 'success',
    });
  });

  it('treats a 4xx/5xx status as a failure', () => {
    expect(parseNginxLog(raw(LINE_404))).toMatchObject({ statusCode: 404, outcome: 'failure' });
  });

  it('returns undefined for a non-access-log line', () => {
    expect(parseNginxLog(raw('this is not an nginx line'))).toBeUndefined();
  });
});
