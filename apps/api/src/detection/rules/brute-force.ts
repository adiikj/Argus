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

    // keyed per IP *and* account: repeated guesses at one account is password
    // guessing (T1110.001); one IP failing across many accounts is password
    // spraying (T1110.003) — that's password-spraying.ts, not this rule
    const entries = await ctx.window.record(
      `${event.sourceIp}|${event.username ?? ''}`,
      event.eventId,
      WINDOW_MS,
    );
    if (entries.length < THRESHOLD) return undefined;

    return {
      ruleId: RULE_ID,
      severity: 'high',
      entity: event.sourceIp,
      eventIds: entries.map((entry) => entry.eventId),
      message: `${entries.length} failed SSH logins for ${event.username ?? 'an unknown user'} from ${event.sourceIp} in the last ${WINDOW_MS / 1000}s`,
      count: entries.length,
    };
  },
};
