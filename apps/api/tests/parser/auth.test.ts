import { describe, it, expect } from 'vitest';
import type { RawLog } from '@argus/contracts';
import { parseAuthLog } from '../../src/parser/auth.js';

function raw(message: string): RawLog {
  return {
    eventId: '11111111-1111-4111-8111-111111111111',
    timestamp: '2026-07-02T12:00:00.000Z',
    source: 'auth',
    message,
  };
}

describe('parseAuthLog', () => {
  it('parses an accepted SSH login as a success', () => {
    const event = parseAuthLog(raw('Accepted password for jsmith from 203.0.113.5 port 4022 ssh2'));
    expect(event).toMatchObject({
      sourceIp: '203.0.113.5',
      outcome: 'success',
      username: 'jsmith',
    });
  });

  it('parses a failed SSH login as a failure', () => {
    const event = parseAuthLog(raw('Failed password for root from 198.51.100.7 port 51000 ssh2'));
    expect(event).toMatchObject({ sourceIp: '198.51.100.7', outcome: 'failure', username: 'root' });
  });

  it('threads the eventId + timestamp through unchanged', () => {
    const event = parseAuthLog(raw('Accepted password for a from 10.0.0.1 port 22 ssh2'));
    expect(event?.eventId).toBe('11111111-1111-4111-8111-111111111111');
    expect(event?.timestamp).toBe('2026-07-02T12:00:00.000Z');
  });

  it('returns undefined for a line it does not recognise', () => {
    expect(parseAuthLog(raw('sudo: session opened for user root'))).toBeUndefined();
  });
});
