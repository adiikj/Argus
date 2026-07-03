import Fastify from 'fastify';
import type { Logger } from '@argus/logger';
import { SCENARIOS, SCENARIO_NAMES } from './scenarios.js';
import { RateLimiter } from './rate-limit.js';

// 5 immediate fires, refilling at 1 every 5s (12/min sustained) — generous for
// someone clicking through the simulator, tight enough to stop a script from
// hammering the LLM's free-tier quota downstream.
const SIMULATE_LIMITER = new RateLimiter(5, 0.2);

export interface SimulatorDeps {
  port: number;
  log: Logger;
  corsOrigin?: string;
  // returns how many raw logs the scenario emitted
  runScenario: (name: string) => Promise<number>;
}

// The attack-simulator trigger API (architecture §15). Kept deliberately small:
// list the scenarios, fire one, and a healthcheck. Permissive CORS so the
// dashboard control panel (a different origin, Day 10) can call it.
export async function createSimulatorServer(deps: SimulatorDeps) {
  const app = Fastify();

  app.addHook('onRequest', async (req, reply) => {
    reply.header('access-control-allow-origin', deps.corsOrigin ?? '*');
    reply.header('access-control-allow-methods', 'GET, POST, OPTIONS');
    reply.header('access-control-allow-headers', 'content-type');
    if (req.method === 'OPTIONS') reply.code(204).send();
  });

  app.get('/healthz', async () => ({ status: 'ok' }));

  app.get('/simulate', async () => ({
    scenarios: SCENARIO_NAMES.map((name) => ({
      name,
      description: SCENARIOS[name]!.description,
    })),
  }));

  app.post('/simulate/:scenario', async (req, reply) => {
    if (!SIMULATE_LIMITER.tryConsume(req.ip)) {
      return reply.code(429).send({ error: 'rate limited — try again shortly' });
    }
    const { scenario } = req.params as { scenario: string };
    if (!SCENARIOS[scenario]) {
      return reply.code(404).send({ error: `unknown scenario`, scenarios: SCENARIO_NAMES });
    }
    const emitted = await deps.runScenario(scenario);
    deps.log.info({ scenario, emitted }, 'ran simulated scenario');
    return { scenario, emitted };
  });

  await app.listen({ port: deps.port, host: '0.0.0.0' });
  return app;
}
