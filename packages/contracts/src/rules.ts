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
  // 'sigma': a YAML rule in apps/api/rules/<id>.yml; 'code': TypeScript, for
  // logic a Sigma condition can't express
  format: 'sigma' | 'code';
}

const TACTIC = {
  reconnaissance: { id: 'TA0043', name: 'Reconnaissance' },
  initialAccess: { id: 'TA0001', name: 'Initial Access' },
  credentialAccess: { id: 'TA0006', name: 'Credential Access' },
  execution: { id: 'TA0002', name: 'Execution' },
  defenseEvasion: { id: 'TA0005', name: 'Defense Evasion' },
  impact: { id: 'TA0040', name: 'Impact' },
} as const satisfies Record<string, MitreRef>;

export const RULE_CATALOG = {
  'dir-enumeration': {
    id: 'dir-enumeration',
    format: 'sigma',
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
  'scanner-user-agent': {
    id: 'scanner-user-agent',
    format: 'code',
    name: 'Attack tool fingerprint',
    detects:
      'A User-Agent naming offensive tooling (sqlmap, nikto, nuclei, gobuster, ffuf). Once per tool per source per 10 min.',
    severity: 'low',
    stage: 'recon',
    tactic: TACTIC.reconnaissance,
    technique: { id: 'T1595.002', name: 'Active Scanning: Vulnerability Scanning' },
    response: [
      'Expect exploitation attempts next; check this source’s other alerts',
      'Block the source; tool User-Agents are trivially changed, so do not rely on UA filtering alone',
    ],
    scenario: 'sqli',
  },
  'traffic-anomaly': {
    id: 'traffic-anomaly',
    format: 'code',
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
    format: 'sigma',
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
  'password-spraying': {
    id: 'password-spraying',
    format: 'code',
    name: 'Password spraying',
    detects: 'Failed logins for ≥ 5 different accounts from one IP within 5 min.',
    severity: 'high',
    stage: 'access',
    tactic: TACTIC.credentialAccess,
    technique: { id: 'T1110.003', name: 'Brute Force: Password Spraying' },
    response: [
      'Block the source; check other sources for the same username list',
      'Look for any successful login among the targeted accounts',
      'Enforce MFA and screen passwords against common-password lists',
    ],
    scenario: 'password-spray',
  },
  'login-after-brute-force': {
    id: 'login-after-brute-force',
    format: 'code',
    name: 'Login after brute force',
    detects:
      'A successful SSH or Argus console login from a source that just failed ≥ 5 times on that account, or sprayed ≥ 5 accounts, within 10 min.',
    severity: 'critical',
    stage: 'access',
    tactic: TACTIC.initialAccess,
    technique: { id: 'T1078', name: 'Valid Accounts' },
    response: [
      'Treat the account as compromised: kill its sessions and reset its credentials',
      'Review everything the account did after the login',
      'Block the source IP',
    ],
    scenario: 'account-takeover',
  },
  'console-login-brute-force': {
    id: 'console-login-brute-force',
    name: 'Console login brute force',
    detects:
      '≥ 5 failed sign-ins to the Argus console from one IP within 5 min (Argus monitoring its own logins).',
    severity: 'high',
    stage: 'access',
    tactic: TACTIC.credentialAccess,
    technique: { id: 'T1110', name: 'Brute Force' },
    response: [
      'Block the source at the edge; check which console accounts it tried',
      'Make sure no targeted account signed in afterwards (login-after-brute-force)',
      'Rotate the password of any account it was guessing',
    ],
    format: 'sigma',
  },
  'console-session-forgery': {
    id: 'console-session-forgery',
    name: 'Forged console session',
    detects:
      '≥ 10 requests from one IP within 1 min carrying a console session token that fails verification.',
    severity: 'medium',
    stage: 'access',
    tactic: TACTIC.defenseEvasion,
    technique: {
      id: 'T1550.001',
      name: 'Use Alternate Authentication Material: Application Access Token',
    },
    response: [
      'Check whether the tokens are forged, replayed or merely expired',
      'Rotate AUTH_SECRET if forgery is suspected (signs everyone out)',
    ],
    format: 'sigma',
  },
  'ingest-token-guessing': {
    id: 'ingest-token-guessing',
    name: 'Ingest token guessing',
    detects:
      '≥ 3 POST /ingest requests with a missing or wrong shipper token from one IP within 10 min.',
    severity: 'medium',
    stage: 'access',
    tactic: TACTIC.credentialAccess,
    technique: { id: 'T1110', name: 'Brute Force' },
    response: [
      'Block the source; no legitimate shipper retries a rejected token',
      'Rotate INGEST_TOKENS if one may have leaked',
    ],
    format: 'sigma',
  },
  'sqli-attempt': {
    id: 'sqli-attempt',
    format: 'sigma',
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
  'path-traversal': {
    id: 'path-traversal',
    format: 'sigma',
    name: 'Path traversal attempt',
    detects:
      'A ../ (or ..\\) step in the request path or query after repeated URL-decoding, or an overlong-UTF-8 encoded dot/slash.',
    severity: 'high',
    stage: 'access',
    tactic: TACTIC.initialAccess,
    technique: { id: 'T1190', name: 'Exploit Public-Facing Application' },
    response: [
      'Confirm the endpoint resolves file paths against a fixed base directory',
      'Check whether any response returned file contents (status 200, unusual size)',
    ],
    scenario: 'path-traversal',
  },
  'xss-attempt': {
    id: 'xss-attempt',
    format: 'sigma',
    name: 'Cross-site scripting attempt',
    detects:
      '<script>, javascript: URLs, inline event handlers (onerror=, onload=, …) or alert()/document.cookie in the decoded request.',
    severity: 'medium',
    stage: 'execution',
    tactic: TACTIC.execution,
    technique: { id: 'T1059.007', name: 'Command and Scripting Interpreter: JavaScript' },
    response: [
      'Verify the parameter is output-encoded wherever it is rendered',
      'Check the dashboard CSP blocks inline script execution paths in use',
    ],
    scenario: 'xss',
  },
  'command-injection': {
    id: 'command-injection',
    format: 'sigma',
    name: 'OS command injection attempt',
    detects:
      'A shell metacharacter (; | && ` $() followed by a command (id, whoami, cat, curl, wget, …), or ${IFS}, in the decoded request.',
    severity: 'high',
    stage: 'execution',
    tactic: TACTIC.execution,
    technique: { id: 'T1059.004', name: 'Command and Scripting Interpreter: Unix Shell' },
    response: [
      'Check whether the endpoint passes input to a shell; use exec with an argument array instead',
      'Look for outbound connections from the host to addresses in the payload',
    ],
    scenario: 'command-injection',
  },
  'invalid-jwt': {
    id: 'invalid-jwt',
    format: 'sigma',
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
    format: 'sigma',
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
