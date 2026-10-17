import { describe, expect, it } from 'vitest';
import type { NormalizedEvent } from '@argus/contracts';
import { createRuleEngine } from '../../src/detection/engine.js';
import { InMemoryWindowStore } from '../../src/detection/window-store.js';
import { InMemoryBaselineStore } from '../../src/detection/baseline-store.js';
import { bruteForceRule } from '../../src/detection/rules/brute-force.js';
import { rateAbuseRule } from '../../src/detection/rules/rate-abuse.js';

let n = 0;
function event(overrides: Partial<NormalizedEvent>): NormalizedEvent {
  n += 1;
  return {
    eventId: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    timestamp: '2026-10-17T12:00:00.000Z',
    source: 'api-gateway',
    sourceIp: '198.51.100.50',
    outcome: 'success',
    raw: 'x',
    ...overrides,
  };
}

describe('rule engine state isolation', () => {
  // regression: both rules key their window by source IP and used to share
  // one — 40 API calls + 1 failed SSH login read as "41 failed SSH logins"
  it("doesn't let one rule's window entries leak into another's", async () => {
    const engine = createRuleEngine(
      [bruteForceRule, rateAbuseRule],
      new InMemoryWindowStore(),
      new InMemoryBaselineStore(),
    );
    for (let i = 0; i < 40; i += 1) await engine.evaluate(event({ path: '/api/login' }));

    const alerts = await engine.evaluate(
      event({ source: 'auth', outcome: 'failure', username: 'root' }),
    );
    expect(alerts.map((a) => a.ruleId)).not.toContain('brute-force-ssh');
  });
});
