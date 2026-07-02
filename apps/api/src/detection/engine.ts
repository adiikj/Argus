import { randomUUID } from 'node:crypto';
import type { NormalizedEvent, Alert } from '@argus/contracts';
import type { Rule, RuleContext } from './rule.js';
import { WindowStore } from './window-store.js';

export interface RuleEngine {
  evaluate: (event: NormalizedEvent) => Alert[];
}

export function createRuleEngine(rules: Rule[]): RuleEngine {
  const ctx: RuleContext = { window: new WindowStore() };

  return {
    evaluate(event) {
      const alerts: Alert[] = [];
      for (const rule of rules) {
        const pending =
          rule.kind === 'stateless' ? rule.evaluate(event) : rule.evaluate(event, ctx);
        if (!pending) continue;
        alerts.push({ ...pending, alertId: randomUUID(), timestamp: new Date().toISOString() });
      }
      return alerts;
    },
  };
}
