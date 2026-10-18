import type { Rule } from './rule.js';
import { loadRuleDir } from './sigma/index.js';
import { anomalyRule } from './rules/anomaly.js';
import { passwordSprayingRule } from './rules/password-spraying.js';
import { loginAfterBruteForceRule } from './rules/login-after-brute-force.js';
import { scannerUserAgentRule } from './rules/scanner-user-agent.js';

export { createRuleEngine, type RuleEngine } from './engine.js';
export type { Rule, RuleContext, PendingAlert } from './rule.js';
export { runFixtures, type CompiledRule } from './sigma/index.js';
export {
  SeenEventIds,
  InMemoryWindowStore,
  RedisWindowStore,
  type WindowStore,
} from './window-store.js';
export { InMemoryBaselineStore, RedisBaselineStore, type BaselineStore } from './baseline-store.js';

// detection-as-code: the signature and threshold rules are Sigma-style YAML
// in apps/api/rules, each carrying its own fixture tests. Compiled once at
// boot; a rule that fails to parse or validate stops the api from starting.
export const YAML_RULES = loadRuleDir();

// every rule the engine runs: the YAML rules, then the ones that need more
// than a Sigma condition can say (distinct-account counting with fire-once
// semantics, cross-pattern correlation, tool extraction, per-source
// baselines). Each must have an entry in the shared rule catalog
// (@argus/contracts/rules); tests/detection/catalog.test.ts checks it.
export const RULES: Rule[] = [
  ...YAML_RULES.map((c) => c.rule),
  passwordSprayingRule,
  loginAfterBruteForceRule,
  scannerUserAgentRule,
  anomalyRule,
];
