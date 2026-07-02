import type { StatelessRule } from '../rule.js';

export const RULE_ID = 'dir-enumeration';

// paths only a scanner/attacker asks for; matched on the path without its query.
const SENSITIVE = [
  '/.env',
  '/.git',
  '/admin',
  '/wp-login.php',
  '/phpmyadmin',
  '/config.php',
  '/backup.zip',
  '/api/v1/internal',
];

function isSensitive(path: string): boolean {
  const p = path.split('?')[0] ?? path;
  return SENSITIVE.some((s) => p === s || p.startsWith(`${s}/`));
}

// stateless: a single request to a known-sensitive path is suspicious on its
// own (no window needed — that's the classification).
export const dirEnumRule: StatelessRule = {
  kind: 'stateless',
  id: RULE_ID,
  evaluate: (event) => {
    if (!event.path) return undefined;
    if (!isSensitive(event.path)) return undefined;

    return {
      ruleId: RULE_ID,
      severity: 'medium',
      entity: event.sourceIp,
      eventIds: [event.eventId],
      message: `Sensitive path probe from ${event.sourceIp}: ${event.path}`,
    };
  },
};
