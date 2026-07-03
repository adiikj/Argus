'use client';

import {
  Bug,
  Fingerprint,
  FolderSearch,
  Gauge,
  KeyRound,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { useScenarios, useFireScenario, type ScenarioInfo } from '@/lib/use-simulator';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const SCENARIO_ICON: Record<string, LucideIcon> = {
  'brute-force': KeyRound,
  sqli: Bug,
  'dir-enum': FolderSearch,
  'rate-abuse': Gauge,
  'invalid-jwt': Fingerprint,
};

export default function SimulatorPage() {
  const { data: scenarios, isLoading, isError } = useScenarios();

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="mb-2 text-lg font-semibold text-text-primary">Attack Simulator</h1>
      <p className="mb-6 text-sm text-text-secondary">
        Fire a scenario at the live pipeline — watch it become an alert, an incident, and an AI
        summary on the Alerts page.
      </p>

      {isLoading && <p className="text-sm text-text-secondary">Loading scenarios…</p>}
      {isError && (
        <p className="text-sm text-text-secondary">
          Couldn&apos;t reach the generator — is it running on{' '}
          <code className="font-mono text-xs">NEXT_PUBLIC_GENERATOR_URL</code>?
        </p>
      )}

      {scenarios && (
        <div className="grid gap-4 sm:grid-cols-2">
          {scenarios.map((scenario) => (
            <ScenarioCard key={scenario.name} scenario={scenario} />
          ))}
        </div>
      )}
    </main>
  );
}

function ScenarioCard({ scenario }: { scenario: ScenarioInfo }) {
  const { mutate, isPending, isError, data } = useFireScenario();
  const Icon = SCENARIO_ICON[scenario.name] ?? Zap;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-bg-elevated text-accent">
            <Icon className="h-4 w-4" strokeWidth={1.8} />
          </span>
          <CardTitle className="font-mono">{scenario.name}</CardTitle>
        </div>
        <CardDescription>{scenario.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex items-center gap-3">
        <Button size="sm" disabled={isPending} onClick={() => mutate(scenario.name)}>
          {isPending ? 'Firing…' : 'Launch'}
        </Button>
        {data && (
          <span className="font-mono text-xs text-text-secondary">emitted {data.emitted}</span>
        )}
        {isError && <span className="font-mono text-xs text-severity-critical">failed</span>}
      </CardContent>
    </Card>
  );
}
