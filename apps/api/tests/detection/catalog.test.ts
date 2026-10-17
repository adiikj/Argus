import { describe, expect, it } from 'vitest';
import { RULE_IDS } from '@argus/contracts/rules';
import { RULES } from '../../src/detection/index.js';

// the catalog drives the dashboard's ATT&CK badges, kill chain, coverage page
// and the AI prompts — it must describe exactly the rules the engine runs
describe('rule catalog <-> detection engine', () => {
  it('has an entry for every registered rule, and none for rules that do not exist', () => {
    expect(RULES.map((r) => r.id).sort()).toEqual([...RULE_IDS].sort());
  });
});
