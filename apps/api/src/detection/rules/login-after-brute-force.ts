import { windowStart, type StatefulRule } from '../rule.js';

const FAILED_ATTEMPTS = 5; // same bar as brute-force-ssh
const SPRAYED_ACCOUNTS = 5; // same bar as password-spraying
const WINDOW_MS = 10 * 60_000;
const MAX_CITED_EVENTS = 50;

export const RULE_ID = 'login-after-brute-force';

// stateful: the moment a guessing or spraying campaign *works*. Tracks its
// own failure history (rules don't share state — see the engine), then on a
// successful login from the same source checks whether that success came
// right after a run of failures for the same account, or after the source
// sprayed many accounts. Either way the attacker now holds valid credentials
// (T1078) — the one alert in the set that is critical on its own. Covers the
// console's own sign-ins too, so a guessed analyst password is caught the
// moment it is used.
export const loginAfterBruteForceRule: StatefulRule = {
  kind: 'stateful',
  id: RULE_ID,
  evaluate: async (event, ctx) => {
    // SSH logins, and sign-ins to the Argus console itself (selfmon)
    const signIn =
      event.source === 'auth' || (event.source === 'argus' && !!event.path?.startsWith('/auth/'));
    if (!signIn) return undefined;
    const account = `${event.sourceIp}|${event.username ?? ''}`;

    if (event.outcome === 'failure') {
      await ctx.window.record(`fail:${account}`, event.eventId, WINDOW_MS);
      if (event.username) {
        await ctx.window.record(`users:${event.sourceIp}`, event.username, WINDOW_MS);
      }
      return undefined;
    }

    const failures = await ctx.window.peek(`fail:${account}`, WINDOW_MS);
    const sprayed = await ctx.window.peek(`users:${event.sourceIp}`, WINDOW_MS);
    const guessed = failures.length >= FAILED_ATTEMPTS;
    if (!guessed && sprayed.length < SPRAYED_ACCOUNTS) return undefined;

    const how = guessed
      ? `after ${failures.length} failed attempts on that account`
      : `after failed logins for ${sprayed.length} different accounts`;
    return {
      ruleId: RULE_ID,
      severity: 'critical',
      entity: event.sourceIp,
      eventIds: [
        ...failures.map((entry) => entry.eventId).slice(-MAX_CITED_EVENTS + 1),
        event.eventId,
      ],
      message: `Likely account compromise: ${event.username ?? 'unknown user'} logged in from ${event.sourceIp} ${how}`,
      count: guessed ? failures.length : sprayed.length,
      firstSeenAt: windowStart(guessed ? failures : sprayed),
    };
  },
};
