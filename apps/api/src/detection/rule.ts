import type { NormalizedEvent, Alert } from '@argus/contracts';
import type { WindowStore } from './window-store.js';
import type { BaselineStore } from './baseline-store.js';

// engine fills in alertId + timestamp; the rule only decides *whether* and *why*.
export type PendingAlert = Omit<Alert, 'alertId' | 'timestamp'>;

export interface RuleContext {
  window: WindowStore;
  baseline: BaselineStore;
}

// stateless: pure function, one event in -> optional alert out (SQLi, dir-enum, invalid JWT).
export interface StatelessRule {
  kind: 'stateless';
  id: string;
  evaluate: (event: NormalizedEvent) => PendingAlert | undefined;
}

// stateful: needs per-entity state from ctx — either a sliding window (brute
// force, rate abuse) or a rolling baseline (traffic-anomaly). Async because
// either backing store may be Redis-backed.
export interface StatefulRule {
  kind: 'stateful';
  id: string;
  evaluate: (event: NormalizedEvent, ctx: RuleContext) => Promise<PendingAlert | undefined>;
}

export type Rule = StatelessRule | StatefulRule;
