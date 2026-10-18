import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { compileRule, RuleDoc, type CompiledRule } from './compile.js';

// apps/api/rules, from src/detection/sigma (dev) and dist/detection/sigma (built) alike
export const RULES_DIR = fileURLToPath(new URL('../../../rules/', import.meta.url));

// parse + validate + compile one rule file. Throws with the file name on any
// problem: a broken rule should stop the api at boot, not fail open.
export function loadRuleFile(path: string): CompiledRule {
  try {
    return compileRule(RuleDoc.parse(parse(readFileSync(path, 'utf8'))));
  } catch (err) {
    const detail =
      err instanceof Error && 'issues' in err
        ? JSON.stringify((err as { issues: unknown }).issues)
        : (err as Error).message;
    throw new Error(`invalid rule ${path}: ${detail}`);
  }
}

export function loadRuleDir(dir: string = RULES_DIR): CompiledRule[] {
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
    .sort();
  const compiled = files.map((f) => loadRuleFile(`${dir}${dir.endsWith('/') ? '' : '/'}${f}`));
  const seen = new Set<string>();
  for (const { doc } of compiled) {
    if (seen.has(doc.id)) throw new Error(`duplicate rule id ${doc.id} in ${dir}`);
    seen.add(doc.id);
  }
  return compiled;
}
