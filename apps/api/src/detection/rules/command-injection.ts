import type { StatelessRule } from '../rule.js';
import { decodeRepeatedly } from './decode.js';

export const RULE_ID = 'command-injection';

// a shell metacharacter that starts a new command (; | || && ` $( ) followed
// by a command attackers reach for first — recon (id, whoami, uname), file
// reads (cat), or fetching a second stage (curl, wget). Requiring both halves
// keeps a stray ";" or "|" in a normal query from firing; ${IFS} is the
// space-free evasion trick and suspicious on its own.
const CMD_INJECTION =
  /(;|\|\|?|&&|`|\$\()\s*(cat|ls|id|whoami|uname|hostname|wget|curl|nc|ncat|bash|sh|zsh|python[23]?|perl|php|ping|nslookup|rm|chmod|echo)\b|\$\{IFS\}/i;

export const commandInjectionRule: StatelessRule = {
  kind: 'stateless',
  id: RULE_ID,
  evaluate: (event) => {
    if (!event.path) return undefined;
    if (!CMD_INJECTION.test(decodeRepeatedly(event.path))) return undefined;

    return {
      ruleId: RULE_ID,
      severity: 'high',
      entity: event.sourceIp,
      eventIds: [event.eventId],
      message: `OS command injection attempt from ${event.sourceIp}: ${event.path}`,
    };
  },
};
