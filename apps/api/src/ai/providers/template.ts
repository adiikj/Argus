import { IncidentQuery, type IncidentStatus, type Severity } from '@argus/contracts';
import { ruleInfo } from '@argus/contracts/rules';
import type { LLMProvider } from '../provider.js';
import { KNOWN_RULE_IDS } from '../provider.js';

type RuleId = (typeof KNOWN_RULE_IDS)[number];

const RULE_KEYWORDS: Record<string, RuleId> = {
  'brute force': 'brute-force-ssh',
  'brute-force': 'brute-force-ssh',
  ssh: 'brute-force-ssh',
  sqli: 'sqli-attempt',
  'sql injection': 'sqli-attempt',
  jwt: 'invalid-jwt',
  'rate abuse': 'api-rate-abuse',
  'rate-abuse': 'api-rate-abuse',
  anomaly: 'traffic-anomaly',
  'dir enum': 'dir-enumeration',
  enumeration: 'dir-enumeration',
  spray: 'password-spraying',
  takeover: 'login-after-brute-force',
  compromise: 'login-after-brute-force',
  traversal: 'path-traversal',
  xss: 'xss-attempt',
  'cross-site': 'xss-attempt',
  'command injection': 'command-injection',
  rce: 'command-injection',
  scanner: 'scanner-user-agent',
};

const SEVERITY_WORDS: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];
const STATUS_WORDS: IncidentStatus[] = ['open', 'acknowledged', 'resolved', 'false_positive'];

const TIME_UNIT_MINUTES: Record<'minute' | 'hour' | 'day', number> = {
  minute: 1,
  hour: 60,
  day: 1440,
};

function parseSinceMinutes(q: string): number | undefined {
  const match = q.match(/last (\d+)\s*(minute|hour|day)s?/);
  if (match?.[1] && match[2]) {
    return Number(match[1]) * TIME_UNIT_MINUTES[match[2] as 'minute' | 'hour' | 'day'];
  }
  if (q.includes('last hour')) return 60;
  if (q.includes('today')) {
    return Math.floor((Date.now() - new Date().setHours(0, 0, 0, 0)) / 60_000);
  }
  return undefined;
}

export const templateProvider: LLMProvider = {
  name: 'template',
  async summarize({ incident, alerts }) {
    const rules = [...new Set(alerts.map((a) => a.ruleId))];
    const described = rules.map((id) => {
      const technique = ruleInfo(id)?.technique.id;
      return technique ? `${id} [${technique}]` : id;
    });
    const tactics = [...new Set(rules.flatMap((id) => ruleInfo(id)?.tactic.name ?? []))];
    // the catalog's per-rule first-response steps, deduped across rules
    const playbook = [...new Set(rules.flatMap((id) => ruleInfo(id)?.response ?? []))];
    return {
      summary:
        `${alerts.length} alert(s) from ${incident.correlationKey} across ${rules.length} rule(s): ${described.join(', ')}. ` +
        (tactics.length > 0 ? `MITRE ATT&CK tactics: ${tactics.join(', ')}. ` : '') +
        `Current severity: ${incident.severity}.`,
      iocs: [incident.correlationKey],
      recommendedActions: [`Investigate activity from ${incident.correlationKey}`, ...playbook],
    };
  },
  // zero-network keyword/regex parser — the always-available fallback tier,
  // same role as summarize()'s template branch.
  async translateQuery(question) {
    const q = question.toLowerCase();
    const ruleId = Object.entries(RULE_KEYWORDS).find(([kw]) => q.includes(kw))?.[1];
    const severity = SEVERITY_WORDS.find((s) => q.includes(s));
    const status = STATUS_WORDS.find((s) => q.includes(s.replace('_', ' ')) || q.includes(s));
    const sinceMinutes = parseSinceMinutes(q);
    return IncidentQuery.parse({ ruleId, severity, status, sinceMinutes });
  },
};
