import type {
  Alert,
  Incident,
  IncidentQuery,
  IncidentSummary,
  IpReputation,
} from '@argus/contracts';
import { RULE_IDS, ruleInfo } from '@argus/contracts/rules';

export type SummaryDraft = Omit<IncidentSummary, 'incidentId' | 'generatedBy' | 'generatedAt'>;

export interface SummaryInput {
  incident: Incident;
  alerts: Alert[];
  // threat-intel context for the source IP, when there is any (apps/api/src/intel)
  reputation?: IpReputation;
}

// reputation as one prompt line — reads the same in the template summary
export function reputationLine(r: IpReputation): string {
  const parts = [
    `AbuseIPDB abuse confidence ${r.abuseScore}/100`,
    `${r.totalReports} report(s) from ${r.distinctReporters} source(s)`,
    r.usageType ? `usage: ${r.usageType}` : undefined,
    r.isp ? `ISP: ${r.isp}` : undefined,
    r.isTor ? 'Tor exit node' : undefined,
  ];
  return `Source IP reputation: ${parts.filter(Boolean).join('; ')}.`;
}

// every ruleId the detection engine can emit (from the shared rule catalog) —
// shared by every translateQuery implementation below.
export const KNOWN_RULE_IDS = RULE_IDS;

// one alert as a prompt line, with its ATT&CK mapping so the model can reason
// (and cite) in the same vocabulary the dashboard shows
export function alertLine(alert: Alert): string {
  const info = ruleInfo(alert.ruleId);
  const mitre = info ? ` (${info.technique.id} ${info.technique.name} — ${info.tactic.name})` : '';
  return `- [${alert.severity}] ${alert.ruleId}${mitre}: ${alert.message}`;
}

export interface LLMProvider {
  name: 'llm' | 'template';
  summarize(input: SummaryInput): Promise<SummaryDraft>;
  translateQuery(question: string): Promise<IncidentQuery>;
}
