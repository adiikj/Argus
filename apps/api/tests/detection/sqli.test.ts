import { describe, it, expect } from 'vitest';
import type { NormalizedEvent } from '@argus/contracts';
import { sqliRule, RULE_ID } from '../../src/detection/rules/sqli.js';

// Day 6 spec — drop the `.skip` once you implement the rule (§19). These encode
// a *proposed* design (severity 'high', entity = sourceIp); tune to taste.
function req(source: NormalizedEvent['source'], path: string): NormalizedEvent {
  return {
    eventId: '00000000-0000-4000-8000-000000000001',
    timestamp: '2026-07-02T12:00:00.000Z',
    source,
    sourceIp: '198.51.100.9',
    outcome: 'failure',
    path,
    raw: '',
  };
}

describe('sqliRule', () => {
  it('flags a classic quote-or injection', () => {
    const alert = sqliRule.evaluate(req('api-gateway', "/products?id=1' OR '1'='1"));
    expect(alert).toMatchObject({ ruleId: RULE_ID, severity: 'high', entity: '198.51.100.9' });
    expect(alert?.eventIds).toEqual(['00000000-0000-4000-8000-000000000001']);
  });

  it('flags a URL-encoded UNION SELECT', () => {
    const alert = sqliRule.evaluate(
      req('nginx', '/search?q=%27%20UNION%20SELECT%20password%20FROM%20users--'),
    );
    expect(alert?.ruleId).toBe(RULE_ID);
  });

  it('ignores a benign path', () => {
    expect(sqliRule.evaluate(req('nginx', '/index.html'))).toBeUndefined();
  });

  it('ignores events with no path (e.g. auth)', () => {
    const authEvent: NormalizedEvent = { ...req('auth', '/x'), path: undefined };
    expect(sqliRule.evaluate(authEvent)).toBeUndefined();
  });
});
