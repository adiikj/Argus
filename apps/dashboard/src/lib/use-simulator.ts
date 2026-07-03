'use client';

import { useMutation, useQuery } from '@tanstack/react-query';

const GENERATOR_URL = process.env.NEXT_PUBLIC_GENERATOR_URL ?? 'http://localhost:4200';

export interface ScenarioInfo {
  name: string;
  description: string;
}

async function fetchScenarios(): Promise<ScenarioInfo[]> {
  const res = await fetch(`${GENERATOR_URL}/simulate`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`simulate list failed: ${res.status}`);
  const body = (await res.json()) as { scenarios: ScenarioInfo[] };
  return body.scenarios;
}

export function useScenarios() {
  return useQuery({ queryKey: ['scenarios'], queryFn: fetchScenarios });
}

export interface FireResult {
  scenario: string;
  emitted: number;
}

async function fireScenario(name: string): Promise<FireResult> {
  const res = await fetch(`${GENERATOR_URL}/simulate/${name}`, { method: 'POST' });
  if (!res.ok) throw new Error(`simulate failed: ${res.status}`);
  return (await res.json()) as FireResult;
}

export function useFireScenario() {
  return useMutation({ mutationFn: fireScenario });
}
