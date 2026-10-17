import type { Rule } from './rule.js';
import { bruteForceRule } from './rules/brute-force.js';
import { sqliRule } from './rules/sqli.js';
import { dirEnumRule } from './rules/dir-enum.js';
import { invalidJwtRule } from './rules/invalid-jwt.js';
import { rateAbuseRule } from './rules/rate-abuse.js';
import { anomalyRule } from './rules/anomaly.js';
import { passwordSprayingRule } from './rules/password-spraying.js';
import { loginAfterBruteForceRule } from './rules/login-after-brute-force.js';
import { pathTraversalRule } from './rules/path-traversal.js';
import { xssRule } from './rules/xss.js';
import { commandInjectionRule } from './rules/command-injection.js';
import { scannerUserAgentRule } from './rules/scanner-user-agent.js';

export { createRuleEngine, type RuleEngine } from './engine.js';
export type { Rule, RuleContext, PendingAlert } from './rule.js';
export {
  SeenEventIds,
  InMemoryWindowStore,
  RedisWindowStore,
  type WindowStore,
} from './window-store.js';
export { InMemoryBaselineStore, RedisBaselineStore, type BaselineStore } from './baseline-store.js';

// every rule the engine runs — each must have an entry in the shared rule
// catalog (@argus/contracts/rules); tests/detection/catalog.test.ts checks it
export const RULES: Rule[] = [
  bruteForceRule,
  passwordSprayingRule,
  loginAfterBruteForceRule,
  sqliRule,
  pathTraversalRule,
  xssRule,
  commandInjectionRule,
  dirEnumRule,
  scannerUserAgentRule,
  invalidJwtRule,
  rateAbuseRule,
  anomalyRule,
];
