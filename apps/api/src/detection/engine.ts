import { randomUUID } from 'node:crypto';
import type { NormalizedEvent, Alert } from '@argus/contracts';
import type { Rule, RuleContext } from './rule.js';
import { scopedWindowStore, type WindowStore } from './window-store.js';
import { scopedBaselineStore, type BaselineStore } from './baseline-store.js';

export interface RuleEngine {
  evaluate: (event: NormalizedEvent) => Promise<Alert[]>;
}

export interface RuleEngineOptions {
  // after an alert for (rule, entity), suppress repeats for this long; 0 = off
  throttleMs?: number;
  onSuppressed?: (ruleId: string) => void;
}

export const DEFAULT_THROTTLE_MS = 60_000;

export function createRuleEngine(
  rules: Rule[],
  window: WindowStore,
  baseline: BaselineStore,
  opts: RuleEngineOptions = {},
): RuleEngine {
  const throttleMs = opts.throttleMs ?? DEFAULT_THROTTLE_MS;

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

  // Alert throttling. Real scanners send thousands of requests in minutes;
  // one alert per matching request would bury the analyst and grow a single
  // incident without bound. After an alert for (rule, entity), repeats are
  // suppressed for throttleMs — the next one that does fire says how many it
  // stands in for. State lives in the shared window store (Redis-backed when
  // configured), so it holds across restarts and instances; the suppressed
  // tally is per process, which is fine for a message annotation.
  // Critical alerts always fire: there's no such thing as too many of those.
  const throttle = scopedWindowStore(window, 'engine:throttle');
  const suppressedSince = new Map<string, number>();

  async function shouldEmit(ruleId: string, entity: string, severity: Alert['severity']) {
    if (throttleMs <= 0 || severity === 'critical') return { emit: true, suppressed: 0 };
    const key = `${ruleId}|${entity}`;
    if ((await throttle.peek(key, throttleMs)).length > 0) {
      suppressedSince.set(key, (suppressedSince.get(key) ?? 0) + 1);
      opts.onSuppressed?.(ruleId);
      return { emit: false, suppressed: 0 };
    }
    await throttle.record(key, 'fired', throttleMs);
    const suppressed = suppressedSince.get(key) ?? 0;
    suppressedSince.delete(key);
    return { emit: true, suppressed };
  }

  return {
    async evaluate(event) {
      const alerts: Alert[] = [];
      for (const rule of rules) {
        const pending =
          rule.kind === 'stateless'
            ? rule.evaluate(event)
            : await rule.evaluate(event, contexts.get(rule.id)!);
        if (!pending) continue;

        const { emit, suppressed } = await shouldEmit(rule.id, pending.entity, pending.severity);
        if (!emit) continue;
        const message =
          suppressed > 0
            ? `${pending.message} (+${suppressed} similar suppressed since the last alert)`
            : pending.message;
        alerts.push({
          ...pending,
          message,
          firstSeenAt: pending.firstSeenAt ?? event.timestamp,
          alertId: randomUUID(),
          timestamp: new Date().toISOString(),
        });
      }
      return alerts;
    },
  };
}
