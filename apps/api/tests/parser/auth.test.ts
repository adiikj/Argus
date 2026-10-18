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

describe('parseAuthLog: real sshd lines (shipped via /ingest)', () => {
  it.each([
    [
      'Oct 18 09:00:01 vm sshd[811]: Failed password for root from 203.0.113.9 port 40022 ssh2',
      { username: 'root', outcome: 'failure', sourceIp: '203.0.113.9' },
    ],
    [
      'Failed password for invalid user admin from 203.0.113.9 port 40022 ssh2',
      { username: 'admin', outcome: 'failure' },
    ],
    [
      '2026-10-18T09:00:01.123+00:00 vm sshd-session[5120]: Accepted publickey for deploy from 2001:db8::7 port 52144 ssh2: ED25519 SHA256:abc',
      { username: 'deploy', outcome: 'success', sourceIp: '2001:db8::7' },
    ],
    [
      'Failed keyboard-interactive/pam for root from 198.51.100.4 port 1022 ssh2',
      { username: 'root', outcome: 'failure' },
    ],
  ])('parses %s', (line, expected) => {
    expect(parseAuthLog(raw(line))).toMatchObject(expected);
  });

  it('rejects a line whose "from" is not an IP address', () => {
    expect(
      parseAuthLog(raw('Failed password for root from attacker.example port 1 ssh2')),
    ).toBeUndefined();
  });

  it('ignores other sshd chatter', () => {
    expect(
      parseAuthLog(raw('vm sshd[811]: Connection closed by 203.0.113.9 port 40022 [preauth]')),
    ).toBeUndefined();
  });
});
