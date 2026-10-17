import { describe, expect, it } from 'vitest';
import { ATTACK_STAGES, RULE_CATALOG, RULE_IDS, attackUrl, ruleInfo } from '../src/rules.js';

describe('rule catalog', () => {
  it.each(Object.entries(RULE_CATALOG))('%s is well-formed', (key, rule) => {
    expect(rule.id).toBe(key);
    expect(rule.technique.id).toMatch(/^T\d{4}(\.\d{3})?$/);
    expect(rule.tactic.id).toMatch(/^TA\d{4}$/);
    expect(ATTACK_STAGES).toContain(rule.stage);
    expect(rule.detects.length).toBeGreaterThan(10);
    expect(rule.response.length).toBeGreaterThan(0);
  });

  it('lists every rule id', () => {
    expect([...RULE_IDS].sort()).toEqual(Object.keys(RULE_CATALOG).sort());
  });

  it('builds attack.mitre.org links for techniques and sub-techniques', () => {
    expect(attackUrl('T1190')).toBe('https://attack.mitre.org/techniques/T1190/');
    expect(attackUrl('T1110.001')).toBe('https://attack.mitre.org/techniques/T1110/001/');
  });

  it('returns undefined for an unknown rule id', () => {
    expect(ruleInfo('no-such-rule')).toBeUndefined();
  });
});
