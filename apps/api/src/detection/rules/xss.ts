import type { StatelessRule } from '../rule.js';
import { decodeRepeatedly } from './decode.js';

export const RULE_ID = 'xss-attempt';

// script injection tells in the decoded request: <script>, javascript: URLs,
// inline event handlers (onerror=, onload=, …), and the classic proof-of-
// concept calls. Inline handlers need the "=" so a word like "onload" alone
// in a query doesn't fire.
const XSS_SIGNATURE =
  /<\s*\/?\s*script\b|javascript\s*:|\bon(error|load|mouseover|focus|click|begin|toggle)\s*=|<\s*(svg|img|iframe|body|details)\b[^>]*\bon\w+\s*=|document\.(cookie|domain)|\balert\s*\(/i;

export const xssRule: StatelessRule = {
  kind: 'stateless',
  id: RULE_ID,
  evaluate: (event) => {
    if (!event.path) return undefined;
    if (!XSS_SIGNATURE.test(decodeRepeatedly(event.path))) return undefined;

    return {
      ruleId: RULE_ID,
      severity: 'medium',
      entity: event.sourceIp,
      eventIds: [event.eventId],
      message: `Cross-site scripting attempt from ${event.sourceIp}: ${event.path}`,
    };
  },
};
