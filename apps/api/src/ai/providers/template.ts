import type { LLMProvider } from '../provider.js';

export const templateProvider: LLMProvider = {
  name: 'template',
  async summarize({ incident, alerts }) {
    const rules = [...new Set(alerts.map((a) => a.ruleId))];
    return {
      summary: `${alerts.length} alert(s) from ${incident.correlationKey} across ${rules.length} rule(s): ${rules.join(', ')}. Current severity: ${incident.severity}.`,
      iocs: [incident.correlationKey],
      recommendedActions: [
        `Investigate activity from ${incident.correlationKey}`,
        'Confirm with the relevant rule owners before taking action',
      ],
    };
  },
};
