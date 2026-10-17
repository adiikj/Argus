'use client';

import {
  Play,
  Bug,
  Code,
  Fingerprint,
  FolderSearch,
  FolderTree,
  Gauge,
  KeyRound,
  Terminal,
  UserX,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { RULE_CATALOG } from '@argus/contracts/rules';
import { useScenarios, useFireScenario, type ScenarioInfo } from '@/lib/use-simulator';
import { useToast } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PipelineFlow } from '../_components/pipeline-flow';
import { SystemActivity } from '../_components/system-activity';
import { PageHeader } from '../_components/page-header';

const SCENARIO_ICON: Record<string, LucideIcon> = {
  'brute-force': KeyRound,
  sqli: Bug,
  'dir-enum': FolderSearch,
  'rate-abuse': Gauge,
  'invalid-jwt': Fingerprint,
  'password-spray': Users,
  'account-takeover': UserX,
  'path-traversal': FolderTree,
  xss: Code,
  'command-injection': Terminal,
};

export default function SimulatorPage() {
  const { data: scenarios, isLoading, isError } = useScenarios();

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Attack Simulator"
        description="Fire a scenario at the live pipeline and watch it move stage by stage — then open Alerts for the incident and AI summary it produced."
      />

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <div data-tour="pipeline-flow" className="lg:col-span-2">
          <PipelineFlow />
        </div>
        <SystemActivity />
      </div>

      {isLoading && <p className="text-sm text-text-secondary">Loading scenarios…</p>}
      {isError && (
        <p className="text-sm text-text-secondary">
          Couldn&apos;t reach the generator — is it running on{' '}
          <code className="font-mono text-xs">NEXT_PUBLIC_GENERATOR_URL</code>?
        </p>
      )}

      {scenarios && (
        <div data-tour="scenario-cards" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {scenarios.map((scenario) => (
            <ScenarioCard key={scenario.name} scenario={scenario} />
          ))}
        </div>
      )}
    </main>
  );
}

function ScenarioCard({ scenario }: { scenario: ScenarioInfo }) {
  const { mutate, isPending } = useFireScenario();
  const { push } = useToast();
  const Icon = SCENARIO_ICON[scenario.name] ?? Zap;

  const launch = (): void => {
    mutate(scenario.name, {
      onSuccess: (result) =>
        push(`${scenario.name} fired — ${result.emitted} events emitted`, 'success'),
      onError: () => push(`${scenario.name} failed to fire`, 'error'),
    });
  };

  // the rules this scenario is proven (tests/detection/scenarios.test.ts) to trip
  const trips = Object.values(RULE_CATALOG).filter(
    (rule) => 'scenario' in rule && rule.scenario === scenario.name,
  );

  return (
    <Card className="group flex flex-col transition-colors hover:border-border-strong">
      <CardHeader>
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-border-strong bg-bg-elevated text-accent transition-colors group-hover:border-accent/40">
            <Icon className="h-4 w-4" strokeWidth={1.8} />
          </span>
          <CardTitle className="font-mono text-[13.5px]">{scenario.name}</CardTitle>
        </div>
        <CardDescription className="mt-1">{scenario.description}</CardDescription>
      </CardHeader>
      <CardContent className="mt-auto flex items-end justify-between gap-3">
        <div className="flex min-w-0 flex-wrap gap-1.5">
          {trips.map((rule) => (
            <span
              key={rule.id}
              className="inline-flex items-center gap-1.5 rounded-md border border-border-subtle bg-bg-base/60 px-1.5 py-0.5 text-[11px] text-text-secondary"
            >
              {rule.name}
              <span className="font-mono text-[10px] text-accent">{rule.technique.id}</span>
            </span>
          ))}
        </div>
        <Button
          size="sm"
          variant="secondary"
          disabled={isPending}
          onClick={launch}
          className="shrink-0"
        >
          <Play className="!size-3.5 text-accent" />
          {isPending ? 'Firing…' : 'Launch'}
        </Button>
      </CardContent>
    </Card>
  );
}
