import type { Alert, Incident, IncidentSummary } from '@argus/contracts';

export type SummaryDraft = Omit<IncidentSummary, 'incidentId' | 'generatedBy' | 'generatedAt'>;

export interface SummaryInput {
  incident: Incident;
  alerts: Alert[];
}

export interface LLMProvider {
  name: 'llm' | 'template';
  summarize(input: SummaryInput): Promise<SummaryDraft>;
}
