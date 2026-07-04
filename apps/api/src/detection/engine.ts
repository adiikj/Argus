import { randomUUID } from 'node:crypto';
import type { NormalizedEvent, Alert } from '@argus/contracts';
import type { Rule, RuleContext } from './rule.js';
import type { WindowStore } from './window-store.js';
import type { BaselineStore } from './baseline-store.js';

export interface RuleEngine {
  evaluate: (event: NormalizedEvent) => Promise<Alert[]>;
}

export function createRuleEngine(
  rules: Rule[],
  window: WindowStore,
  baseline: BaselineStore,
): RuleEngine {
  const ctx: RuleContext = { window, baseline };

  return {
    async evaluate(event) {
      const alerts: Alert[] = [];
      for (const rule of rules) {
        const pending =
          rule.kind === 'stateless' ? rule.evaluate(event) : await rule.evaluate(event, ctx);
        if (!pending) continue;
        alerts.push({ ...pending, alertId: randomUUID(), timestamp: new Date().toISOString() });
      }
      return alerts;
    },
  };
}
