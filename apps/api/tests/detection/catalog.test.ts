import { describe, expect, it } from 'vitest';
import { RULE_IDS, ruleInfo } from '@argus/contracts/rules';
import { RULES, YAML_RULES } from '../../src/detection/index.js';

// the catalog drives the dashboard's ATT&CK badges, kill chain, coverage page
// and the AI prompts — it must describe exactly the rules the engine runs
describe('rule catalog <-> detection engine', () => {
  it('has an entry for every registered rule, and none for rules that do not exist', () => {
    expect(RULES.map((r) => r.id).sort()).toEqual([...RULE_IDS].sort());
  });
});

describe('rule catalog <-> YAML rules', () => {
  it("marks exactly the YAML rules as format 'sigma'", () => {
    const sigma = RULE_IDS.filter((id) => ruleInfo(id)?.format === 'sigma');
    expect(sigma.sort()).toEqual(YAML_RULES.map((c) => c.doc.id).sort());
  });
});
