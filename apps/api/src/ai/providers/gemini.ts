import type { LLMProvider, SummaryDraft, SummaryInput } from '../provider.js';

const MODEL = 'gemini-2.0-flash';

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    iocs: { type: 'array', items: { type: 'string' } },
    recommendedActions: { type: 'array', items: { type: 'string' } },
  },
  required: ['summary', 'iocs', 'recommendedActions'],
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

export function createGeminiProvider(apiKey: string): LLMProvider {
  return {
    name: 'llm',
    async summarize(input) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
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
  };
}
