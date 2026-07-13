import { IncidentQuery } from '@argus/contracts';
import {
  KNOWN_RULE_IDS,
  type LLMProvider,
  type SummaryDraft,
  type SummaryInput,
} from '../provider.js';

const DEFAULT_MODEL = 'gemini-2.0-flash';

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    iocs: { type: 'array', items: { type: 'string' } },
    recommendedActions: { type: 'array', items: { type: 'string' } },
  },
  required: ['summary', 'iocs', 'recommendedActions'],
};

// no `required` — every field is optional, the question may only specify one
const QUERY_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    ruleId: { type: 'string', enum: [...KNOWN_RULE_IDS] },
    severity: { type: 'string', enum: ['info', 'low', 'medium', 'high', 'critical'] },
    status: { type: 'string', enum: ['open', 'acknowledged', 'resolved', 'false_positive'] },
    sinceMinutes: { type: 'number' },
  },
};

function buildPrompt({ incident, alerts }: SummaryInput): string {
  const lines = alerts.map((a) => `- [${a.severity}] ${a.ruleId}: ${a.message}`).join('\n');
  return [
    `Security incident from entity ${incident.correlationKey}, severity ${incident.severity}.`,
    `Alerts (${alerts.length}):`,
    lines,
    'Summarize this incident for a SOC analyst, list indicators of compromise, and recommend next actions.',
  ].join('\n');
}

function buildQueryPrompt(question: string): string {
  return [
    'Translate this security-analyst question into a JSON filter.',
    `Known rule ids: ${KNOWN_RULE_IDS.join(', ')}.`,
    'Only include fields the question actually specifies; omit the rest.',
    `Question: ${question}`,
  ].join('\n');
}

export function createGeminiProvider(apiKey: string, model: string = DEFAULT_MODEL): LLMProvider {
  return {
    name: 'llm',
    async summarize(input) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: buildPrompt(input) }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              responseSchema: RESPONSE_SCHEMA,
            },
          }),
        },
      );
      if (!res.ok) throw new Error(`gemini request failed: ${res.status}`);

      const body = (await res.json()) as {
        candidates?: Array<{ content: { parts: Array<{ text?: string }> } }>;
      };
      const text = body.candidates?.[0]?.content.parts[0]?.text;
      if (!text) throw new Error('gemini returned no content');

      return JSON.parse(text) as SummaryDraft;
    },
    async translateQuery(question) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: buildQueryPrompt(question) }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              responseSchema: QUERY_RESPONSE_SCHEMA,
            },
          }),
        },
      );
      if (!res.ok) throw new Error(`gemini request failed: ${res.status}`);

      const body = (await res.json()) as {
        candidates?: Array<{ content: { parts: Array<{ text?: string }> } }>;
      };
      const text = body.candidates?.[0]?.content.parts[0]?.text;
      if (!text) throw new Error('gemini returned no content');

      return IncidentQuery.parse(JSON.parse(text));
    },
  };
}
