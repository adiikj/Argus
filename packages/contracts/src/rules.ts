// The detection rule catalog — one entry per rule the api's detection engine
// runs (apps/api/src/detection/rules/*), the single source of truth for what
// each ruleId *means*: its MITRE ATT&CK mapping, its attack stage, and what to
// do about it. The dashboard (badges, kill chain, coverage page), the AI layer
// (prompts, template summaries, query translation) and the README all read it.
//
// Mappings are derived from ruleId at read time rather than stored on each
// alert, so a corrected mapping applies to historical alerts too.

export type AttackStage = 'recon' | 'access' | 'execution' | 'impact';

export interface MitreRef {
  id: string; // TA0006 / T1110.001
  name: string;
}

export interface RuleInfo {
  id: string;
  name: string;
  // what the rule actually looks for, incl. thresholds — shown on /coverage
  detects: string;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  stage: AttackStage;
  tactic: MitreRef;
  technique: MitreRef;
  // first-response guidance, used by the template summarizer and /coverage
  response: string[];
  // the attack simulator scenario that exercises this rule, if any
  scenario?: string;
}

const TACTIC = {
  reconnaissance: { id: 'TA0043', name: 'Reconnaissance' },
  initialAccess: { id: 'TA0001', name: 'Initial Access' },
  credentialAccess: { id: 'TA0006', name: 'Credential Access' },
  defenseEvasion: { id: 'TA0005', name: 'Defense Evasion' },
  impact: { id: 'TA0040', name: 'Impact' },
} as const satisfies Record<string, MitreRef>;

export const RULE_CATALOG = {
  'dir-enumeration': {
    id: 'dir-enumeration',
    name: 'Sensitive path enumeration',
    detects:
      'A request for a path only scanners ask for (/.env, /.git, /wp-login.php, /phpmyadmin, …).',
    severity: 'medium',
    stage: 'recon',
    tactic: TACTIC.reconnaissance,
    technique: { id: 'T1595.003', name: 'Active Scanning: Wordlist Scanning' },
    response: [
      'Confirm none of the probed paths exist or are reachable (.env, .git, backups)',
      'Rate-limit or block the source at the edge',
    ],
    scenario: 'dir-enum',
  },
  'traffic-anomaly': {
    id: 'traffic-anomaly',
    name: 'Traffic anomaly',
    detects:
      "A source's request rate 3σ above its own rolling 60 s baseline (10 s buckets, ≥ 8 requests).",
    severity: 'medium',
    stage: 'recon',
    tactic: TACTIC.reconnaissance,
    technique: { id: 'T1595', name: 'Active Scanning' },
    response: [
      'Check what the source requested during the spike',
      'Watch for follow-up exploitation',
    ],
  },
  'brute-force-ssh': {
    id: 'brute-force-ssh',
    name: 'SSH brute force',
    detects: '≥ 5 failed SSH logins for the same account from one IP within 60 s.',
    severity: 'high',
    stage: 'access',
    tactic: TACTIC.credentialAccess,
    technique: { id: 'T1110.001', name: 'Brute Force: Password Guessing' },
    response: [
      'Block the source IP (fail2ban / NSG rule)',
      'Enforce key-based SSH auth; disable password login for root',
    ],
    scenario: 'brute-force',
  },
  'sqli-attempt': {
    id: 'sqli-attempt',
    name: 'SQL injection attempt',
    detects:
      "A request path carrying SQL injection syntax (' OR, UNION SELECT, ; DROP TABLE, comment terminators), checked after URL-decoding.",
    severity: 'high',
    stage: 'access',
    tactic: TACTIC.initialAccess,
    technique: { id: 'T1190', name: 'Exploit Public-Facing Application' },
    response: [
      'Verify the endpoint uses parameterized queries',
      'Check database logs for statements that actually ran',
      'Block the source; consider a WAF rule for the payload',
    ],
    scenario: 'sqli',
  },
  'invalid-jwt': {
    id: 'invalid-jwt',
    name: 'Invalid token use',
    detects: 'An API request rejected with 401 for an invalid or expired JWT.',
    severity: 'low',
    stage: 'access',
    tactic: TACTIC.defenseEvasion,
    technique: {
      id: 'T1550.001',
      name: 'Use Alternate Authentication Material: Application Access Token',
    },
    response: [
      'Check whether the tokens are forged, replayed or merely expired',
      'Rotate the signing key if forgery is suspected',
    ],
    scenario: 'invalid-jwt',
  },
  'api-rate-abuse': {
    id: 'api-rate-abuse',
    name: 'API rate abuse',
    detects: '> 30 API requests from one IP within 10 s.',
    severity: 'medium',
    stage: 'impact',
    tactic: TACTIC.impact,
    technique: {
      id: 'T1499.003',
      name: 'Endpoint Denial of Service: Application Exhaustion Flood',
    },
    response: ['Apply per-client rate limits at the gateway', 'Block the source if it persists'],
    scenario: 'rate-abuse',
  },
} as const satisfies Record<string, RuleInfo>;

export type RuleId = keyof typeof RULE_CATALOG;

export const RULE_IDS = Object.keys(RULE_CATALOG) as [RuleId, ...RuleId[]];

export const ATTACK_STAGES: readonly AttackStage[] = ['recon', 'access', 'execution', 'impact'];

// undefined for a ruleId the catalog doesn't know (e.g. an alert from a rule
// that has since been removed) — callers fall back to the raw id
export function ruleInfo(ruleId: string): RuleInfo | undefined {
  return (RULE_CATALOG as Record<string, RuleInfo>)[ruleId];
}

// T1110.001 -> https://attack.mitre.org/techniques/T1110/001/
export function attackUrl(techniqueId: string): string {
  return `https://attack.mitre.org/techniques/${techniqueId.replace('.', '/')}/`;
}
