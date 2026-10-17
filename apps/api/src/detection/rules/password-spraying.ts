import type { StatefulRule } from '../rule.js';

const DISTINCT_USERS = 5; // different accounts failed from one IP…
const WINDOW_MS = 5 * 60_000; // …within this trailing window

export const RULE_ID = 'password-spraying';

// stateful: a few attempts each across *many* accounts — staying under any
// per-account lockout — is spraying (T1110.003), the mirror image of
// brute-force-ssh's many attempts at *one* account. Counts distinct usernames
// by recording the username itself as the window member (set semantics).
export const passwordSprayingRule: StatefulRule = {
  kind: 'stateful',
  id: RULE_ID,
  evaluate: async (event, ctx) => {
    if (event.source !== 'auth' || event.outcome !== 'failure' || !event.username) {
      return undefined;
    }

    const before = await ctx.window.peek(`users:${event.sourceIp}`, WINDOW_MS);
    const users = await ctx.window.record(`users:${event.sourceIp}`, event.username, WINDOW_MS);
    const events = await ctx.window.record(`events:${event.sourceIp}`, event.eventId, WINDOW_MS);

    // fire once, on the failure that brings in the Nth distinct account —
    // more failures against already-seen accounts don't re-alert
    if (users.length !== DISTINCT_USERS || before.length === users.length) return undefined;

    return {
      ruleId: RULE_ID,
      severity: 'high',
      entity: event.sourceIp,
      eventIds: events.map((entry) => entry.eventId),
      message: `Password spraying from ${event.sourceIp}: failed logins for ${users.length} different accounts (${users.map((u) => u.eventId).join(', ')}) in ${WINDOW_MS / 60_000} min`,
      count: users.length,
    };
  },
};
