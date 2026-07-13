import type { Incident } from '@argus/contracts';

export interface WebhookOptions {
  webhookUrl: string;
  dashboardUrl?: string;
}

function severityEmoji(severity: Incident['severity']): string {
  return severity === 'critical' ? '🔴' : '🚨';
}

function buildMessage(opts: WebhookOptions, incident: Incident): string {
  const lines = [
    `${severityEmoji(incident.severity)} [${incident.severity.toUpperCase()}] Incident from ${incident.correlationKey}`,
    `${incident.alertIds.length} alert${incident.alertIds.length === 1 ? '' : 's'}`,
  ];
  if (opts.dashboardUrl) {
    lines.push(`${opts.dashboardUrl.replace(/\/$/, '')}/incidents/${incident.incidentId}`);
  }
  return lines.join('\n');
}

// plain fetch, Slack-compatible incoming-webhook body ({text}) — same
// no-SDK philosophy as the LLMProvider integrations.
export async function sendWebhookNotification(
  opts: WebhookOptions,
  incident: Incident,
): Promise<void> {
  const res = await fetch(opts.webhookUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text: buildMessage(opts, incident) }),
  });
  if (!res.ok) throw new Error(`webhook request failed: ${res.status}`);
}
