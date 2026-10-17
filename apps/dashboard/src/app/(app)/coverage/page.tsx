import Link from 'next/link';
import { ATTACK_STAGES, RULE_CATALOG, type AttackStage, type RuleInfo } from '@argus/contracts/rules';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AttackTechnique } from '../_components/attack-technique';
import { PageHeader } from '../_components/page-header';

export const metadata = { title: 'Detection Coverage · Argus' };

const STAGE_LABEL: Record<AttackStage, string> = {
  recon: 'Reconnaissance',
  access: 'Access attempt',
  execution: 'Execution',
  impact: 'Impact',
};

const RULES: RuleInfo[] = Object.values(RULE_CATALOG);

function RuleCard({ rule }: { rule: RuleInfo }) {
  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="mr-auto">{rule.name}</CardTitle>
          <Badge variant={rule.severity}>{rule.severity}</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-text-secondary">
          <span className="rounded bg-bg-elevated px-2 py-0.5 font-mono text-[11px]">{rule.id}</span>
          <AttackTechnique ruleId={rule.id} link />
          <span>
            {rule.technique.name} · {rule.tactic.name}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-text-primary">{rule.detects}</p>
        <ul className="list-disc space-y-1 pl-5 text-text-secondary">
          {rule.response.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ul>
        {rule.scenario && (
          <Link href="/simulator" className="inline-block font-mono text-xs text-accent hover:underline">
            Try it: simulator → {rule.scenario}
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

// what Argus can detect, in MITRE ATT&CK terms — straight from the shared rule
// catalog (@argus/contracts/rules), so it can't drift from the engine
export default function CoveragePage() {
  const techniques = new Set(RULES.map((r) => r.technique.id));
  const tactics = new Set(RULES.map((r) => r.tactic.name));

  return (
<main className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Detection Coverage"
        description={`What Argus can detect, in MITRE ATT&CK terms — straight from the rule catalog the engine runs, so this page can't drift from reality.`}
      />
      <div className="mb-8 grid grid-cols-3 gap-4">
        {[
          [RULES.length, 'detection rules'],
          [techniques.size, 'ATT&CK techniques'],
          [tactics.size, 'tactics covered'],
        ].map(([value, label]) => (
          <Card key={String(label)} className="px-5 py-4">
            <div className="text-gradient font-mono text-3xl font-semibold">{value}</div>
            <div className="mt-1 text-[12px] text-text-secondary">{label}</div>
          </Card>
        ))}
      </div>
      <div className="mb-8 flex flex-wrap gap-2">
        {[...tactics].map((t) => (
          <span key={t} className="rounded-full border border-border-strong bg-bg-panel px-3 py-1 text-[12px] text-text-secondary">
            {t}
          </span>
        ))}
      </div>

      {ATTACK_STAGES.map((stage) => {
        const rules = RULES.filter((r) => r.stage === stage);
        if (rules.length === 0) return null;
        return (
          <section key={stage} className="mb-8">
            <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.15em] text-text-secondary">
              {STAGE_LABEL[stage]} · {rules.length}
            </h2>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {rules.map((rule) => (
                <RuleCard key={rule.id} rule={rule} />
              ))}
            </div>
          </section>
        );
      })}
    </main>
  );
}
