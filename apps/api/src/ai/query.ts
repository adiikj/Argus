import type { Logger } from '@argus/logger';
import type { IncidentQuery } from '@argus/contracts';
import type { LLMProvider } from './provider.js';
import { templateProvider } from './providers/template.js';

// mirrors engine.ts's existing try/catch-to-template fallback exactly — the
// same orchestration shape, just for query translation instead of summaries.
export async function translateQuery(
  provider: LLMProvider,
  question: string,
  log: Logger,
): Promise<IncidentQuery> {
  try {
    return await provider.translateQuery(question);
  } catch (err) {
    log.warn({ err }, 'llm query translation failed, falling back to template');
    return templateProvider.translateQuery(question);
  }
}
