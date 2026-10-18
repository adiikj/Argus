import { describe, expect, it } from 'vitest';
import type { Alert } from '@argus/contracts';
import { parseRawLog } from '../../src/parser/index.js';
import { securityEventLog } from '../../src/selfmon/index.js';
import {
  createRuleEngine,
  InMemoryBaselineStore,
  InMemoryWindowStore,
  RULES,
} from '../../src/detection/index.js';

describe('self-monitoring end to end', () => {
  it('turns a guessed console password into incidents-worthy alerts', async () => {
    const engine = createRuleEngine(RULES, new InMemoryWindowStore(), new InMemoryBaselineStore());
    const signIn = (outcome: 'success' | 'failure') =>
      parseRawLog(
        securityEventLog({
          ip: '203.0.113.66',
          method: 'POST',
          path: '/auth/login',
          status: outcome === 'success' ? 200 : 401,
          outcome,
          reason: outcome === 'success' ? 'password login' : 'bad email or password',
          user: 'a*6@argus.buzz',
        }),
      )!;

    const alerts: Alert[] = [];
    for (let i = 0; i < 6; i += 1) alerts.push(...(await engine.evaluate(signIn('failure'))));
    alerts.push(...(await engine.evaluate(signIn('success'))));

    expect(alerts.map((a) => a.ruleId)).toEqual([
      'console-login-brute-force',
      'login-after-brute-force',
    ]);
    expect(alerts[1]).toMatchObject({ severity: 'critical', entity: '203.0.113.66' });
    // and SSH-only rules stay out of it
    expect(alerts.map((a) => a.ruleId)).not.toContain('brute-force-ssh');
  });
});
