// single partition per topic in V1, but every topic has a
// documented key strategy so the scale-out story is visible without being built.
export const TOPICS = {
  RAW_LOGS: 'raw.logs', // generator -> api, keyed by eventId (no parsed IP yet)
  EVENTS_NORMALIZED: 'events.normalized', // post-parse, keyed by sourceIp
  ALERTS: 'alerts', // detections, keyed by the alert's entity (usually sourceIp)
} as const;

export type Topic = (typeof TOPICS)[keyof typeof TOPICS];
