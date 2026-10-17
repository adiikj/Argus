import { describe, it, expect } from 'vitest';
import { RULE_CATALOG } from '@argus/contracts/rules';
import { createRuleEngine, RULES } from '../../src/detection/index.js';
import { InMemoryWindowStore } from '../../src/detection/window-store.js';
import { InMemoryBaselineStore } from '../../src/detection/baseline-store.js';
import { parseRawLog } from '../../src/parser/index.js';
import { SCENARIOS, benignEvent } from '../../../generator/src/scenarios.js';

// end to end through the real wire formats: generator scenario -> raw log ->
// parser -> every rule. Pins that each scenario the coverage page advertises
// ("try it: simulator → X") really trips its rule, and that benign background
// traffic trips nothing.
async function rulesFiredBy(rawLogs: ReturnType<typeof benignEvent>[]): Promise<Set<string>> {
  const engine = createRuleEngine(RULES, new InMemoryWindowStore(), new InMemoryBaselineStore());
  const fired = new Set<string>();
  for (const raw of rawLogs) {
    const event = parseRawLog(raw);
    expect(event, `unparseable: ${raw.message}`).toBeDefined();
    for (const alert of await engine.evaluate(event!)) fired.add(alert.ruleId);
  }
  return fired;
}

describe('simulator scenarios -> detection rules', () => {
  const advertised = Object.values(RULE_CATALOG).flatMap((rule) =>
    'scenario' in rule ? [[rule.scenario, rule.id] as const] : [],
  );

  it.each(advertised)('scenario %s trips %s', async (scenario, ruleId) => {
    const generate = SCENARIOS[scenario]?.generate;
    expect(generate, `no such scenario: ${scenario}`).toBeDefined();
    expect(await rulesFiredBy(generate!())).toContain(ruleId);
  });

  it('benign background traffic trips no rule', async () => {
    const fired = await rulesFiredBy(Array.from({ length: 600 }, benignEvent));
    expect([...fired]).toEqual([]);
  });
});
