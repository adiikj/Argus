import { attackUrl, ruleInfo } from '@argus/contracts/rules';
import { cn } from '@/lib/utils';

const CHIP =
  'shrink-0 rounded border border-accent/25 bg-accent/10 px-1.5 py-0.5 font-mono text-[10px] text-accent';

// MITRE ATT&CK technique chip for a ruleId (from the shared rule catalog).
// `link` makes it open the technique on attack.mitre.org — leave it off inside
// an element that's already a link (nested <a> is invalid HTML).
export function AttackTechnique({
  ruleId,
  link = false,
  className,
}: {
  ruleId: string;
  link?: boolean;
  className?: string;
}) {
  const info = ruleInfo(ruleId);
  if (!info) return null;
  const title = `MITRE ATT&CK ${info.technique.id} — ${info.technique.name} (${info.tactic.name})`;

  if (!link) {
    return (
      <span className={cn(CHIP, className)} title={title}>
        {info.technique.id}
      </span>
    );
  }
  return (
    <a
      href={attackUrl(info.technique.id)}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
      className={cn(CHIP, 'transition-colors hover:bg-accent/20', className)}
    >
      {info.technique.id}
    </a>
  );
}
