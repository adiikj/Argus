import type { StatelessRule } from '../rule.js';
import { decodeRepeatedly } from './decode.js';

export const RULE_ID = 'path-traversal';

// a parent-directory step (../ or ..\) anywhere in the decoded path/query,
// plus the overlong-UTF-8 encodings of "." and "/" that decodeURIComponent
// rejects outright (so they never decode — matched on the raw path instead)
const DOT_DOT = /(^|[/\\=])\.\.([/\\]|$)/;
const OVERLONG = /%c0%ae|%e0%80%ae|%c0%af|%c1%9c/i;

// stateless: one request trying to climb out of the web root is the attack
export const pathTraversalRule: StatelessRule = {
  kind: 'stateless',
  id: RULE_ID,
  evaluate: (event) => {
    if (!event.path) return undefined;
    if (!DOT_DOT.test(decodeRepeatedly(event.path)) && !OVERLONG.test(event.path)) {
      return undefined;
    }

    return {
      ruleId: RULE_ID,
      severity: 'high',
      entity: event.sourceIp,
      eventIds: [event.eventId],
      message: `Path traversal attempt from ${event.sourceIp}: ${event.path}`,
    };
  },
};
