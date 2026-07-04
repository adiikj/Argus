import type { StatefulRule } from '../rule.js';

const BUCKET_MS = 10_000; // 10s buckets
const HISTORY_BUCKETS = 6; // trailing 60s of baseline
const Z_THRESHOLD = 3; // "3-sigma" above the entity's own recent baseline
const MIN_COUNT = 8; // floor so a first-ever request doesn't score as infinite-anomaly noise

export const RULE_ID = 'traffic-anomaly';

// qualitatively different from the other stateful rules: rate-abuse fires on
// one fixed global threshold (>30 requests/window for everyone); this fires
// on deviation from each entity's OWN recent baseline, so a source that's
// normally quiet gets judged against its own history, not a number every
// other IP is also held to.
export const anomalyRule: StatefulRule = {
  kind: 'stateful',
  id: RULE_ID,
  evaluate: async (event, ctx) => {
    if (event.source !== 'nginx') return undefined;

    const { count, zScore } = await ctx.baseline.observe(
      event.sourceIp,
      BUCKET_MS,
      HISTORY_BUCKETS,
    );
    if (count < MIN_COUNT || zScore < Z_THRESHOLD) return undefined;

    const deviation = Number.isFinite(zScore) ? `${zScore.toFixed(1)}σ` : 'far';
    return {
      ruleId: RULE_ID,
      severity: 'medium',
      entity: event.sourceIp,
      eventIds: [event.eventId],
      message: `${event.sourceIp}'s nginx traffic is ${deviation} above its own recent baseline (${count} reqs/${BUCKET_MS / 1000}s)`,
      count,
    };
  },
};
