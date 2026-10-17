import { Search, KeyRound, Terminal, Zap, type LucideIcon } from 'lucide-react';
import type { Alert } from '@argus/contracts';
import { ATTACK_STAGES, ruleInfo, type AttackStage } from '@argus/contracts/rules';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { AttackTechnique } from './attack-technique';

type Stage = AttackStage;

const STAGE_ORDER = ATTACK_STAGES;

const STAGE_LABEL: Record<Stage, string> = {
  recon: 'Reconnaissance',
  access: 'Access attempt',
  execution: 'Execution',
  impact: 'Impact',
};

const STAGE_ICON: Record<Stage, LucideIcon> = {
  recon: Search,
  access: KeyRound,
  execution: Terminal,
  impact: Zap,
};

// each rule's stage comes from the shared rule catalog (@argus/contracts/rules),
// alongside its MITRE ATT&CK technique — shown per stage below
export function KillChain({ alerts }: { alerts: Alert[] }) {
  const rulesByStage: Record<Stage, Set<string>> = {
    recon: new Set(),
    access: new Set(),
    execution: new Set(),
    impact: new Set(),
  };
  for (const alert of alerts) {
    const stage = ruleInfo(alert.ruleId)?.stage;
    if (stage) rulesByStage[stage].add(alert.ruleId);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Attack progression</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-start">
          {STAGE_ORDER.map((stage, i) => {
            const rules = [...rulesByStage[stage]];
            const hit = rules.length > 0;
            const Icon = STAGE_ICON[stage];
            return (
              <div key={stage} className="flex flex-1 items-start">
                <div className="flex flex-col items-center gap-2 text-center">
                  <span
                    className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border',
                      hit
                        ? 'border-accent bg-accent/10 text-accent'
                        : 'border-border-subtle text-text-secondary',
                    )}
                  >
                    <Icon className="h-4 w-4" strokeWidth={1.8} />
                  </span>
                  <span
                    className={cn(
                      'font-mono text-[10px] uppercase tracking-wider',
                      hit ? 'text-text-primary' : 'text-text-secondary',
                    )}
                  >
                    {STAGE_LABEL[stage]}
                  </span>
                  <span className="flex max-w-[8rem] flex-wrap justify-center gap-1 text-[11px] leading-snug text-text-secondary">
                    {hit
                      ? rules.map((ruleId) => <AttackTechnique key={ruleId} ruleId={ruleId} link />)
                      : '—'}
                  </span>
                </div>
                {i < STAGE_ORDER.length - 1 && (
                  <div
                    className={cn('mt-5 h-px flex-1', hit ? 'bg-accent/40' : 'bg-border-subtle')}
                  />
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
