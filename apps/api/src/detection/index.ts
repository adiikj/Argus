import type { Rule } from './rule.js';
import { bruteForceRule } from './rules/brute-force.js';

export { createRuleEngine, type RuleEngine } from './engine.js';
export type { Rule, RuleContext, PendingAlert } from './rule.js';
export { SeenEventIds } from './window-store.js';

export const RULES: Rule[] = [bruteForceRule];
