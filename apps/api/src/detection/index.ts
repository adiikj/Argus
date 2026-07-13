import type { Rule } from './rule.js';
import { bruteForceRule } from './rules/brute-force.js';
import { sqliRule } from './rules/sqli.js';
import { dirEnumRule } from './rules/dir-enum.js';
import { invalidJwtRule } from './rules/invalid-jwt.js';
import { rateAbuseRule } from './rules/rate-abuse.js';
import { anomalyRule } from './rules/anomaly.js';

export { createRuleEngine, type RuleEngine } from './engine.js';
export type { Rule, RuleContext, PendingAlert } from './rule.js';
export {
  SeenEventIds,
  InMemoryWindowStore,
  RedisWindowStore,
  type WindowStore,
} from './window-store.js';
export { InMemoryBaselineStore, RedisBaselineStore, type BaselineStore } from './baseline-store.js';

// Day 6 rules are registered but their bodies are author-written (§19): each is
// a safe no-op (returns undefined) until its TODO is filled in.
export const RULES: Rule[] = [
  bruteForceRule,
  sqliRule,
  dirEnumRule,
  invalidJwtRule,
  rateAbuseRule,
  anomalyRule,
];
