import { describe, it, expect } from 'vitest';
import type { NormalizedEvent } from '@argus/contracts';
import { dirEnumRule, RULE_ID } from '../../src/detection/rules/dir-enum.js';

// Day 6 spec — remove `.skip` once implemented (§19). Proposed: severity
// 'medium', entity = sourceIp.
function req(path: string): NormalizedEvent {
  return {
    eventId: '00000000-0000-4000-8000-000000000002',
    timestamp: '2026-07-02T12:00:00.000Z',
    source: 'nginx',
    sourceIp: '198.51.100.9',
    outcome: 'failure',
    path,
    raw: '',
  };
}

describe('dirEnumRule', () => {
  it('flags a request to /.env', () => {
    expect(dirEnumRule.evaluate(req('/.env'))).toMatchObject({
      ruleId: RULE_ID,
      entity: '198.51.100.9',
    });
  });

  it('flags a request to /wp-login.php', () => {
    expect(dirEnumRule.evaluate(req('/wp-login.php'))?.ruleId).toBe(RULE_ID);
  });

  it('ignores an ordinary page', () => {
    expect(dirEnumRule.evaluate(req('/index.html'))).toBeUndefined();
  });

  it('ignores events with no path', () => {
    const authEvent: NormalizedEvent = { ...req('/x'), source: 'auth', path: undefined };
    expect(dirEnumRule.evaluate(authEvent)).toBeUndefined();
  });
});
