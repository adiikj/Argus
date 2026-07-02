import Fastify from 'fastify';
import type { Logger } from '@argus/logger';
import { SCENARIOS, SCENARIO_NAMES } from './scenarios.js';

export interface SimulatorDeps {
  port: number;
  log: Logger;
  // returns how many raw logs the scenario emitted
  runScenario: (name: string) => Promise<number>;
}

// The attack-simulator trigger API (architecture §15). Kept deliberately small:
// list the scenarios, fire one, and a healthcheck. Permissive CORS so the
// dashboard control panel (a different origin, Day 10) can call it.
export async function createSimulatorServer(deps: SimulatorDeps) {
  const app = Fastify();

  app.addHook('onRequest', async (req, reply) => {
    reply.header('access-control-allow-origin', '*');
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
