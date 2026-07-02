import { describe, it, expect } from 'vitest';
import type { RawLog } from '@argus/contracts';
import { parseApiGatewayLog } from '../../src/parser/api-gateway.js';

function raw(message: string): RawLog {
  return {
    eventId: '33333333-3333-4333-8333-333333333333',
    timestamp: '2026-07-02T12:00:00.000Z',
    source: 'api-gateway',
    message,
  };
}

describe('parseApiGatewayLog', () => {
  it('parses a structured JSON gateway line', () => {
    const line = JSON.stringify({
      ip: '203.0.113.5',
      method: 'POST',
      path: '/login',
      status: 200,
      userAgent: 'curl/8.0',
      user: 'admin',
    });
    expect(parseApiGatewayLog(raw(line))).toMatchObject({
      sourceIp: '203.0.113.5',
      method: 'POST',
      path: '/login',
      statusCode: 200,
      username: 'admin',
      outcome: 'success',
    });
  });

  it('maps a 401 to a failure', () => {
    const line = JSON.stringify({
      ip: '198.51.100.7',
      method: 'GET',
      path: '/api/account',
      status: 401,
    });
    expect(parseApiGatewayLog(raw(line))).toMatchObject({ statusCode: 401, outcome: 'failure' });
  });

  it('returns undefined for malformed JSON', () => {
    expect(parseApiGatewayLog(raw('{not json'))).toBeUndefined();
  });

  it('returns undefined when required fields are missing', () => {
    expect(parseApiGatewayLog(raw(JSON.stringify({ ip: '203.0.113.5' })))).toBeUndefined();
  });

  it('returns undefined when the ip is not a valid address', () => {
    const line = JSON.stringify({ ip: 'nope', method: 'GET', path: '/', status: 200 });
    expect(parseApiGatewayLog(raw(line))).toBeUndefined();
  });
});
