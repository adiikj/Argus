import type { StatelessRule } from '../rule.js';
import { decodeRepeatedly } from './decode.js';

export const RULE_ID = 'sqli-attempt';

// common SQLi tells: quote-based OR, UNION SELECT, comment terminators, stacked
// DROP. Tested against the *decoded* path (repeatedly — see decode.ts) so
// %-encoded and double-encoded payloads still match.
const SQLI_SIGNATURE = /('\s*or\s|\bunion\s+select\b|;\s*drop\s+table\b|--|\bor\s+1\s*=\s*1\b)/i;

// stateless: one HTTP request in -> optional alert out. Only sources that carry
// a request path (nginx, api-gateway) are relevant.
export const sqliRule: StatelessRule = {
  kind: 'stateless',
  id: RULE_ID,
  evaluate: (event) => {
    if (!event.path) return undefined;
    if (!SQLI_SIGNATURE.test(decodeRepeatedly(event.path))) return undefined;

    return {
      ruleId: RULE_ID,
      severity: 'high',
      entity: event.sourceIp,
      eventIds: [event.eventId],
      message: `Possible SQL injection from ${event.sourceIp}: ${event.path}`,
    };
  },
};
