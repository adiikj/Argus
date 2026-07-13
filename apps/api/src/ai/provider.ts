import type { Alert, Incident, IncidentQuery, IncidentSummary } from '@argus/contracts';

export type SummaryDraft = Omit<IncidentSummary, 'incidentId' | 'generatedBy' | 'generatedAt'>;

export interface SummaryInput {
  incident: Incident;
  alerts: Alert[];
}

// confirmed exact strings from apps/api/src/detection/rules/*.ts's RULE_ID
// exports — shared by every translateQuery implementation below.
export const KNOWN_RULE_IDS = [
  'brute-force-ssh',
  'sqli-attempt',
  'dir-enumeration',
  'api-rate-abuse',
  'invalid-jwt',
  'traffic-anomaly',
] as const;

export interface LLMProvider {
  name: 'llm' | 'template';
  summarize(input: SummaryInput): Promise<SummaryDraft>;
  translateQuery(question: string): Promise<IncidentQuery>;
}
