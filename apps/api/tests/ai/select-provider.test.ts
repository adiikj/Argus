import { describe, it, expect } from 'vitest';
import type { AppConfig } from '@argus/config';
import { selectProvider } from '../../src/ai/select-provider.js';

function config(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    NODE_ENV: 'test',
    LOG_LEVEL: 'info',
    PORT: 4100,
    GENERATOR_PORT: 4200,
    KAFKA_BROKERS: ['localhost:9092'],
    POSTGRES_URL: 'postgresql://argus:argus@localhost:5432/argus',
    ES_NODE: 'http://localhost:9200',
    STORAGE_PROFILE: 'full',
    LLM_PROVIDER: 'none',
    DEMO_MODE: false,
    ...overrides,
  };
}

describe('selectProvider', () => {
  it('falls back to the template provider when LLM_PROVIDER is none', () => {
    expect(selectProvider(config()).name).toBe('template');
  });

  it('falls back to the template provider when the configured key is missing', () => {
    expect(selectProvider(config({ LLM_PROVIDER: 'gemini' })).name).toBe('template');
    expect(selectProvider(config({ LLM_PROVIDER: 'groq' })).name).toBe('template');
  });

  it('uses the llm provider once a matching key is present', () => {
    expect(selectProvider(config({ LLM_PROVIDER: 'gemini', GEMINI_API_KEY: 'k' })).name).toBe(
      'llm',
    );
    expect(selectProvider(config({ LLM_PROVIDER: 'groq', GROQ_API_KEY: 'k' })).name).toBe('llm');
  });
});
