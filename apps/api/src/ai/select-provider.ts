import type { AppConfig } from '@argus/config';
import type { LLMProvider } from './provider.js';
import { templateProvider } from './providers/template.js';
import { createGeminiProvider } from './providers/gemini.js';
import { createGroqProvider } from './providers/groq.js';

export function selectProvider(config: AppConfig): LLMProvider {
  if (config.LLM_PROVIDER === 'gemini' && config.GEMINI_API_KEY) {
    return createGeminiProvider(config.GEMINI_API_KEY);
  }
  if (config.LLM_PROVIDER === 'groq' && config.GROQ_API_KEY) {
    return createGroqProvider(config.GROQ_API_KEY);
  }
  return templateProvider;
}
