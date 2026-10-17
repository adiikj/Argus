import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { RULE_CATALOG } from '@argus/contracts/rules';

// the README's coverage table is generated from the catalog — fail when a
// rule or its technique changes without the table being regenerated
describe('README detection coverage table', () => {
  const readme = readFileSync(new URL('../../../../README.md', import.meta.url), 'utf8');

  it.each(Object.values(RULE_CATALOG))('lists $id with $technique.id', (rule) => {
    const row = readme.split('\n').find((line) => line.includes(`\`${rule.id}\``));
    expect(row, `${rule.id} missing from README`).toBeDefined();
    expect(row).toContain(rule.technique.id);
  });
});
