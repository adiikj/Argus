import type { Logger } from '@argus/logger';
import { IncidentSummary, type Incident } from '@argus/contracts';
import type { PrismaClient } from '../incident/index.js';
import type { Bus } from '../bus/index.js';
import type { LLMProvider } from './provider.js';
import { templateProvider } from './providers/template.js';
import { createSummaryQueue } from './queue.js';
import { shouldResummarize, type SummarizedState } from './resummarize.js';
import { loadIncidentContext } from './context.js';

const CONCURRENCY = 2;
const DEBOUNCE_MS = 4000;

export interface AiEngineDeps {
  prisma: PrismaClient;
  bus: Bus;
  provider: LLMProvider;
  log: Logger;
}

export function startAiEngine({ prisma, bus, provider, log }: AiEngineDeps): void {
  const state = new Map<string, SummarizedState>();

  const queue = createSummaryQueue({
    concurrency: CONCURRENCY,
    debounceMs: DEBOUNCE_MS,
    run: async (incidentId) => {
      try {
        const context = await loadIncidentContext(prisma, incidentId);
        if (!context) return;

        let generatedBy: 'llm' | 'template' = provider.name;
        let draft;
        try {
          draft = await provider.summarize(context);
        } catch (err) {
          log.warn({ incidentId, err }, 'llm summary failed, falling back to template');
          draft = await templateProvider.summarize(context);
          generatedBy = 'template';
        }

        const summary = IncidentSummary.parse({
          incidentId,
          ...draft,
          generatedBy,
          generatedAt: new Date().toISOString(),
        });

        await prisma.summary.upsert({
          where: { incidentId },
          create: {
            incidentId: summary.incidentId,
            summary: summary.summary,
            iocs: summary.iocs,
            recommendedActions: summary.recommendedActions,
            generatedBy: summary.generatedBy,
            generatedAt: new Date(summary.generatedAt),
          },
          update: {
            summary: summary.summary,
            iocs: summary.iocs,
            recommendedActions: summary.recommendedActions,
            generatedBy: summary.generatedBy,
            generatedAt: new Date(summary.generatedAt),
          },
        });

        state.set(incidentId, {
          severity: context.incident.severity,
          alertCount: context.incident.alertIds.length,
        });
        bus.emit('summary.ready', summary);
        log.info({ incidentId, generatedBy }, 'incident summary generated');
      } catch (err) {
        log.error({ incidentId, err }, 'summary job failed');
      }
    },
  });

  const handle = (event: { incident: Incident }): void => {
    if (!shouldResummarize(state.get(event.incident.incidentId), event.incident)) return;
    queue.schedule(event.incident.incidentId);
  };

  bus.on('incident.created', handle);
  bus.on('incident.updated', handle);
}
