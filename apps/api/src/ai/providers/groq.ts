import type { LLMProvider, SummaryDraft, SummaryInput } from '../provider.js';

const MODEL = 'llama-3.3-70b-versatile';

function buildPrompt({ incident, alerts }: SummaryInput): string {
  const lines = alerts.map((a) => `- [${a.severity}] ${a.ruleId}: ${a.message}`).join('\n');
  return [
    `Security incident from entity ${incident.correlationKey}, severity ${incident.severity}.`,
    `Alerts (${alerts.length}):`,
    lines,
  ].join('\n');
}

export function createGroqProvider(apiKey: string): LLMProvider {
  return {
    name: 'llm',
    async summarize(input) {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: MODEL,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content:
                'You are a SOC analyst assistant. Reply with JSON only: {"summary": string, "iocs": string[], "recommendedActions": string[]}.',
            },
            { role: 'user', content: buildPrompt(input) },
          ],
        }),
      });
      if (!res.ok) throw new Error(`groq request failed: ${res.status}`);

      const body = (await res.json()) as { choices?: Array<{ message: { content?: string } }> };
      const text = body.choices?.[0]?.message.content;
      if (!text) throw new Error('groq returned no content');

      return JSON.parse(text) as SummaryDraft;
    },
  };
}
