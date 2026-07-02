import type { StatelessRule } from '../rule.js';

export const RULE_ID = 'invalid-jwt';

// stateless: an api-gateway request rejected for auth reasons. Note the
// tradeoff — a per-event 401 rule is inherently noisy; §6 keeps it stateless
// for simplicity, a real system would likely window it.
export const invalidJwtRule: StatelessRule = {
  kind: 'stateless',
  id: RULE_ID,
  evaluate: (event) => {
    if (event.source !== 'api-gateway') return undefined;
    if (event.statusCode !== 401) return undefined;

    return {
      ruleId: RULE_ID,
      severity: 'low',
      entity: event.sourceIp,
      eventIds: [event.eventId],
      message: `Invalid or expired token from ${event.sourceIp} on ${event.path ?? 'unknown path'}`,
    };
  },
};
