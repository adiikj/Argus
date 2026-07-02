import type { StatefulRule } from '../rule.js';

// tune once you've watched it against the rate-abuse scenario's traffic.
const THRESHOLD = 30; // requests
const WINDOW_MS = 10_000; // trailing window

export const RULE_ID = 'api-rate-abuse';

// stateful: requests per IP per window, same shape as brute-force-ssh.
export const rateAbuseRule: StatefulRule = {
  kind: 'stateful',
  id: RULE_ID,
  evaluate: (event, ctx) => {
    if (event.source !== 'api-gateway') return undefined;

    // record every gateway request under the source IP; the window returns all
    // entries still inside WINDOW_MS (see WindowStore).
    const recent = ctx.window.record(event.sourceIp, event.eventId, WINDOW_MS);

    if (recent.length > THRESHOLD) {
      return {
        ruleId: RULE_ID,
        severity: 'medium',
        entity: event.sourceIp,
        eventIds: recent.map((entry) => entry.eventId),
        message: `${recent.length} API requests from ${event.sourceIp} in ${WINDOW_MS / 1000}s (rate abuse)`,
        count: recent.length,
      };
    }
    return undefined;
  },
};
