import type { StatefulRule } from '../rule.js';

// basic thresholds — tune once you've seen this fire against real traffic.
const THRESHOLD = 5; // failed logins
const WINDOW_MS = 60_000; // trailing window

export const RULE_ID = 'brute-force-ssh';

export const bruteForceRule: StatefulRule = {
  kind: 'stateful',
  id: RULE_ID,
  evaluate: async (event, ctx) => {
    if (event.source !== 'auth' || event.outcome !== 'failure') return undefined;

    const entries = await ctx.window.record(event.sourceIp, event.eventId, WINDOW_MS);
    if (entries.length < THRESHOLD) return undefined;

    return {
      ruleId: RULE_ID,
      severity: 'high',
      entity: event.sourceIp,
      eventIds: entries.map((entry) => entry.eventId),
      message: `${entries.length} failed SSH logins from ${event.sourceIp} in the last ${WINDOW_MS / 1000}s`,
      count: entries.length,
    };
  },
};
