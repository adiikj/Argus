// the YAML rules (apps/api/rules), compiled, for tests that drive one directly
import { loadRuleDir } from '../../src/detection/sigma/index.js';
import type { StatefulRule, StatelessRule } from '../../src/detection/rule.js';

const compiled = loadRuleDir();

function find(id: string) {
  const rule = compiled.find((c) => c.doc.id === id)?.rule;
  if (!rule) throw new Error(`no YAML rule ${id}`);
  return rule;
}

export function statelessRule(id: string): StatelessRule {
  const rule = find(id);
  if (rule.kind !== 'stateless') throw new Error(`${id} is stateful`);
  return rule;
}

export function statefulRule(id: string): StatefulRule {
  const rule = find(id);
  if (rule.kind !== 'stateful') throw new Error(`${id} is stateless`);
  return rule;
}
