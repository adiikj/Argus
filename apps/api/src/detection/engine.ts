import { randomUUID } from 'node:crypto';
import type { NormalizedEvent, Alert } from '@argus/contracts';
import type { Rule, RuleContext } from './rule.js';
import { scopedWindowStore, type WindowStore } from './window-store.js';
import { scopedBaselineStore, type BaselineStore } from './baseline-store.js';

export interface RuleEngine {
  evaluate: (event: NormalizedEvent) => Promise<Alert[]>;
}

export function createRuleEngine(
  rules: Rule[],
  window: WindowStore,
  baseline: BaselineStore,
): RuleEngine {
  // every rule gets its own key namespace in the shared stores, so state is
  // isolated per rule no matter what key a rule picks (see scopedWindowStore)
  const contexts = new Map<string, RuleContext>(
    rules.map((rule) => [
      rule.id,
      {
        window: scopedWindowStore(window, rule.id),
        baseline: scopedBaselineStore(baseline, rule.id),
      },
    ]),
  );

  return {
    async evaluate(event) {
      const alerts: Alert[] = [];
      for (const rule of rules) {
        const pending =
          rule.kind === 'stateless'
            ? rule.evaluate(event)
            : await rule.evaluate(event, contexts.get(rule.id)!);
        if (!pending) continue;
        alerts.push({ ...pending, alertId: randomUUID(), timestamp: new Date().toISOString() });
      }
      return alerts;
    },
  };
}
