import { Search, KeyRound, Zap, type LucideIcon } from 'lucide-react';
import type { Alert } from '@argus/contracts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type Stage = 'recon' | 'access' | 'impact';

const STAGE_ORDER: Stage[] = ['recon', 'access', 'impact'];

const STAGE_LABEL: Record<Stage, string> = {
  recon: 'Reconnaissance',
  access: 'Access attempt',
  impact: 'Impact',
};

const STAGE_ICON: Record<Stage, LucideIcon> = {
  recon: Search,
  access: KeyRound,
  impact: Zap,
};

// maps each of the six live detection rules to the stage of an attack it
// actually represents — not a full MITRE ATT&CK mapping, just what this
// rule set genuinely covers.
const RULE_STAGE: Record<string, Stage> = {
  'dir-enumeration': 'recon',
  'traffic-anomaly': 'recon',
  'brute-force-ssh': 'access',
  'sqli-attempt': 'access',
  'invalid-jwt': 'access',
  'api-rate-abuse': 'impact',
};

export function KillChain({ alerts }: { alerts: Alert[] }) {
  const rulesByStage: Record<Stage, Set<string>> = {
    recon: new Set(),
    access: new Set(),
    impact: new Set(),
  };
  for (const alert of alerts) {
    const stage = RULE_STAGE[alert.ruleId];
    if (stage) rulesByStage[stage].add(alert.ruleId);
  }

  return (
    <Card className="mb-6">
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
                  <span className="max-w-[7rem] text-[11px] leading-snug text-text-secondary">
                    {hit ? rules.join(', ') : '—'}
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
