'use client';

import { useEffect, useState } from 'react';
import type { Severity } from '@argus/contracts';
import { ruleInfo, type AttackStage } from '@argus/contracts/rules';

// A scripted, backend-free preview of the console for the landing page —
// the real rules, real ATT&CK mappings and a real campaign shape (recon →
// exploitation → credential attack → compromise), replayed on a loop.
interface Step {
  ruleId: string;
  severity: Severity;
  entity: string;
  message: string;
}

const ATTACKER = '45.148.10.12';

const SCRIPT: Step[] = [
  {
    ruleId: 'scanner-user-agent',
    severity: 'low',
    entity: ATTACKER,
    message: 'Known attack tool fingerprint: zgrab',
  },
  {
    ruleId: 'dir-enumeration',
    severity: 'medium',
    entity: ATTACKER,
    message: 'Sensitive path probe: /.env',
  },
  {
    ruleId: 'sqli-attempt',
    severity: 'high',
    entity: ATTACKER,
    message: "SQL injection: /products?id=1' OR '1'='1",
  },
  {
    ruleId: 'path-traversal',
    severity: 'high',
    entity: ATTACKER,
    message: 'Path traversal: /download?file=../../etc/passwd',
  },
  {
    ruleId: 'password-spraying',
    severity: 'high',
    entity: ATTACKER,
    message: 'Failed logins for 6 different accounts in 5 min',
  },
  {
    ruleId: 'brute-force-ssh',
    severity: 'high',
    entity: ATTACKER,
    message: '7 failed SSH logins for deploy in 60 s',
  },
  {
    ruleId: 'login-after-brute-force',
    severity: 'critical',
    entity: ATTACKER,
    message: 'Likely account compromise: deploy logged in',
  },
];

const STAGES: Array<{ id: AttackStage; label: string }> = [
  { id: 'recon', label: 'Recon' },
  { id: 'access', label: 'Access' },
  { id: 'execution', label: 'Execution' },
  { id: 'impact', label: 'Impact' },
];

const SUMMARY =
  'A single source ran a full campaign: tool-driven recon for exposed secrets, injection probes against the API, then password spraying that narrowed to the deploy account and ended in a successful login (T1078). Treat deploy as compromised — kill its sessions, rotate credentials, and block 45.148.10.12 at the edge.';

const DOT: Record<Severity, string> = {
  critical: 'bg-severity-critical',
  high: 'bg-severity-high',
  medium: 'bg-severity-medium',
  low: 'bg-severity-low',
  info: 'bg-severity-info',
};

const TEXT: Record<Severity, string> = {
  critical: 'text-severity-critical',
  high: 'text-severity-high',
  medium: 'text-severity-medium',
  low: 'text-severity-low',
  info: 'text-severity-info',
};

function clock(offsetSeconds = 0): string {
  return new Date(Date.now() - offsetSeconds * 1000).toLocaleTimeString(undefined, {
    hour12: false,
  });
}

interface Shown extends Step {
  key: number;
  time: string;
}

export function LiveDemo() {
  const [shown, setShown] = useState<Shown[]>([]);
  const [typed, setTyped] = useState(0);
  const [events, setEvents] = useState(48_210);

  useEffect(() => {
    let cursor = 0;
    let key = 0;
    const push = (): void => {
      if (cursor % SCRIPT.length === 0) {
        // a new campaign: open with its first few alerts so the feed is never empty
        const opening = SCRIPT.slice(0, 3)
          .map((step, i) => ({ ...step, key: key++, time: clock(3 - i) }))
          .reverse();
        cursor = 3;
        setTyped(0);
        setShown(opening);
        return;
      }
      const step = SCRIPT[cursor % SCRIPT.length]!;
      cursor += 1;
      setShown((prev) => [{ ...step, key: key++, time: clock() }, ...prev].slice(0, 7));
    };
    push();
    const feed = setInterval(push, 1700);
    const ticker = setInterval(() => setEvents((n) => n + 3 + Math.floor(Math.random() * 14)), 400);
    return () => {
      clearInterval(feed);
      clearInterval(ticker);
    };
  }, []);

  const compromised = shown.some((s) => s.severity === 'critical');

  // the summary "writes itself" once the campaign succeeds
  useEffect(() => {
    if (!compromised) return;
    const t = setInterval(() => setTyped((n) => Math.min(SUMMARY.length, n + 3)), 18);
    return () => clearInterval(t);
  }, [compromised]);

  const stagesHit = new Set(shown.map((s) => ruleInfo(s.ruleId)?.stage));
  const topSeverity: Severity = compromised ? 'critical' : shown.length > 2 ? 'high' : 'medium';

  return (
    <div className="relative">
      <div
        aria-hidden
        className="animate-glow absolute -inset-x-10 -top-10 -bottom-4 -z-10 rounded-[3rem] bg-[radial-gradient(50%_60%_at_50%_0%,color-mix(in_srgb,var(--color-accent)_45%,transparent),transparent_70%)] blur-2xl"
      />

      <div className="border-gradient relative overflow-hidden rounded-2xl bg-bg-panel shadow-[0_40px_120px_-30px_rgb(0_0_0/0.9)]">
        {/* window chrome */}
        <div className="flex items-center justify-between border-b border-border-subtle bg-bg-elevated/70 px-4 py-3">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
          </div>
          <div className="rounded-md border border-border-subtle bg-bg-base/70 px-3 py-1 font-mono text-[11px] text-text-muted">
            argus.buzz/alerts
          </div>
          <div className="flex items-center gap-1.5 font-mono text-[11px] text-severity-ok">
            <span className="h-1.5 w-1.5 rounded-full bg-severity-ok shadow-[0_0_8px_var(--color-severity-ok)]" />
            live
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5">
          {/* alert feed */}
          <div className="min-w-0 border-border-subtle lg:col-span-3 lg:border-r">
            <div className="flex items-center justify-between border-b border-border-subtle px-5 py-3">
              <span className="text-[13px] font-medium">Live alerts</span>
              <span className="font-mono text-[11px] text-text-muted">
                <span className="tabular-nums text-text-secondary">{events.toLocaleString()}</span>{' '}
                events
              </span>
            </div>
            <ul className="flex min-h-[300px] flex-col gap-1.5 p-3 lg:min-h-[388px]">
              {shown.map((s) => (
                <li
                  key={s.key}
                  className="animate-alert-in flex items-center gap-3 rounded-lg border border-border-subtle bg-bg-base/60 px-3 py-2.5"
                >
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT[s.severity]}`} />
                  <span
                    className={`w-14 shrink-0 font-mono text-[10px] font-medium uppercase ${TEXT[s.severity]}`}
                  >
                    {s.severity}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[12.5px] text-text-primary">
                    {s.message}
                  </span>
                  <span className="hidden shrink-0 rounded border border-accent/25 bg-accent/10 px-1.5 py-0.5 font-mono text-[10px] text-accent sm:inline">
                    {ruleInfo(s.ruleId)?.technique.id}
                  </span>
                  <span className="hidden shrink-0 font-mono text-[10px] tabular-nums text-text-muted md:inline">
                    {s.time}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* the incident it became */}
          <div className="flex min-w-0 flex-col gap-4 border-t border-border-subtle p-5 lg:col-span-2 lg:border-t-0">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium">Incident</span>
              <span
                className={`rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase ${
                  topSeverity === 'critical'
                    ? 'border-severity-critical/35 bg-severity-critical/12 text-severity-critical'
                    : 'border-severity-high/35 bg-severity-high/12 text-severity-high'
                }`}
              >
                {topSeverity}
              </span>
            </div>
            <div className="font-mono text-sm text-text-primary">
              {ATTACKER}{' '}
              <span className="block text-[12px] text-text-muted sm:inline">
                · NL · AbuseIPDB 100/100
              </span>
            </div>

            <div className="grid grid-cols-4 gap-1.5">
              {STAGES.map((stage) => {
                const hit = stagesHit.has(stage.id);
                return (
                  <div
                    key={stage.id}
                    className={`truncate rounded-md border px-1 py-2 text-center font-mono text-[9px] uppercase tracking-wide transition-colors sm:px-2 sm:text-[10px] ${
                      hit
                        ? 'border-accent/40 bg-accent/10 text-accent'
                        : 'border-border-subtle text-text-muted'
                    }`}
                  >
                    {stage.label}
                  </div>
                );
              })}
            </div>

            <div className="flex-1 rounded-lg border border-border-subtle bg-bg-base/60 p-4">
              <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-accent">
                <span className="text-gradient font-semibold">AI summary</span>
                {compromised && typed < SUMMARY.length && <span className="animate-blink">▍</span>}
              </div>
              <p className="text-[12.5px] leading-relaxed text-text-secondary">
                {compromised ? SUMMARY.slice(0, typed) : 'Correlating alerts from this source…'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
