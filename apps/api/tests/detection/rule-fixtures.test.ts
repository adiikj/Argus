import { describe, expect, it } from 'vitest';
import { ruleInfo } from '@argus/contracts/rules';
import { runFixtures, YAML_RULES } from '../../src/detection/index.js';

// detection-as-code: every YAML rule ships its own match / nomatch fixtures,
// and this suite runs all of them. Adding a rule file adds its tests here.
describe.each(YAML_RULES.map((c) => [c.doc.id, c] as const))('%s', (id, compiled) => {
  it('passes its own fixtures', async () => {
    expect(await runFixtures(compiled)).toEqual([]);
  });

  it('agrees with the shared rule catalog', () => {
    const info = ruleInfo(id);
    expect(info, `${id} is missing from @argus/contracts/rules`).toBeDefined();
    expect(compiled.doc.title).toBe(info!.name);
    expect(compiled.severity).toBe(info!.severity);
    expect(compiled.doc.tags).toContain(`attack.${info!.technique.id.toLowerCase()}`);
  });
});
