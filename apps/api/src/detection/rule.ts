import type { NormalizedEvent, Alert } from '@argus/contracts';
import type { WindowStore } from './window-store.js';

// engine fills in alertId + timestamp; the rule only decides *whether* and *why*.
export type PendingAlert = Omit<Alert, 'alertId' | 'timestamp'>;

export interface RuleContext {
  window: WindowStore;
}

// stateless: pure function, one event in -> optional alert out (SQLi, dir-enum, invalid JWT).
export interface StatelessRule {
  kind: 'stateless';
  id: string;
  evaluate: (event: NormalizedEvent) => PendingAlert | undefined;
}

// stateful: needs a sliding window of prior events keyed by some entity (brute force, rate abuse).
export interface StatefulRule {
  kind: 'stateful';
  id: string;
  evaluate: (event: NormalizedEvent, ctx: RuleContext) => PendingAlert | undefined;
}

export type Rule = StatelessRule | StatefulRule;
