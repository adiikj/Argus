import { describe, it, expect } from 'vitest';
import type { NormalizedEvent } from '@argus/contracts';
import { invalidJwtRule, RULE_ID } from '../../src/detection/rules/invalid-jwt.js';

// Day 6 spec — remove `.skip` once implemented (§19). Proposed: 401 -> alert,
// severity 'low', entity = sourceIp.
function gw(
  statusCode: number,
  source: NormalizedEvent['source'] = 'api-gateway',
): NormalizedEvent {
  return {
    eventId: '00000000-0000-4000-8000-000000000003',
    timestamp: '2026-07-02T12:00:00.000Z',
    source,
    sourceIp: '198.51.100.9',
    outcome: statusCode < 400 ? 'success' : 'failure',
    path: '/api/account',
    statusCode,
    raw: '',
  };
}

describe('invalidJwtRule', () => {
  it('flags an api-gateway 401 as an invalid/expired token', () => {
    expect(invalidJwtRule.evaluate(gw(401))).toMatchObject({
      ruleId: RULE_ID,
      entity: '198.51.100.9',
    });
  });

  it('ignores a successful request', () => {
    expect(invalidJwtRule.evaluate(gw(200))).toBeUndefined();
  });

  it('ignores non-gateway sources', () => {
    expect(invalidJwtRule.evaluate(gw(401, 'nginx'))).toBeUndefined();
  });
});
