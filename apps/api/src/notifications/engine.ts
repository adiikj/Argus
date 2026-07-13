import type { Logger } from '@argus/logger';
import type { Incident } from '@argus/contracts';
import type { Bus } from '../bus/index.js';
import { sendWebhookNotification, type WebhookOptions } from './webhook.js';
import { shouldNotify, type NotifiedState } from './notify-gate.js';

// deliberately in-memory only, not persisted — mirrors ai/engine.ts's own
// debounce Map precedent exactly (resets on restart; a rare duplicate ping
// after one is equally low-cost, same tradeoff already accepted there).
export function startWebhookNotifier(bus: Bus, opts: WebhookOptions, log: Logger): void {
  const state = new Map<string, NotifiedState>();

  const handle = (event: { incident: Incident }): void => {
    const { incident } = event;
    if (!shouldNotify(state.get(incident.incidentId), incident)) return;

    state.set(incident.incidentId, { notifiedAt: Date.now() });
    sendWebhookNotification(opts, incident).catch((err: unknown) => {
      log.warn({ incidentId: incident.incidentId, err }, 'webhook notify failed');
    });
  };

  bus.on('incident.created', handle);
  bus.on('incident.updated', handle);
}
