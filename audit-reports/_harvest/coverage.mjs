import { readFileSync, readdirSync } from 'node:fs';

const DIR = 'audit-reports/_harvest';
const RANK = { critical: 0, high: 1, medium: 2, low: 3 };

const session = readdirSync(DIR)
  .filter((f) => /^findings-session.*\.json$/.test(f))
  .flatMap((f) => JSON.parse(readFileSync(`${DIR}/${f}`, 'utf8')));

const harvested = JSON.parse(readFileSync(`${DIR}/live-findings.json`, 'utf8'));

const LENSES = [
  '01 documentation', '02 contract-fidelity', '03 test-coverage', '04 test-hardening',
  '05 test-architecture', '06 test-consolidation', '07 test-quality',
  '09 integration-boundary-testing', '10 api-design-consistency', '11 contract-schema-drift',
  '13 security-sweep', '14 privacy-pii-handling', '15 dependency-health', '16 codebase-cleanup',
  '17 cross-cutting-concerns', '19 function-centralization-discovery', '20 building-block-adoption',
  '21 code-elegance', '22 architectural-complexity', '23 scar-tissue-analysis',
  '25 universal-feature-compliance', '26 default-values-magic-constants', '27 datetime-handling',
  '28 logging-error-quality', '29 data-integrity', '30 error-recovery', '31 idempotency-safe-retry',
  '32 external-integration-reliability', '33 race-condition',
  '34 implicit-ordering-hidden-dependencies', '35 resource-lifecycle-cleanup',
  '36 error-message-quality', '37 bug-hunt', '38 performance', '39 cost-resource-optimization',
  '40 frontend-quality', '41 ui-ux', '42 state-management', '43 perceived-performance',
  '46 devops', '48 observability', '49 backup-check', '50 product-polish',
  '52 strategic-opportunities',
];

const count = {};
for (const f of session) count[f.lens] = (count[f.lens] || 0) + 1;

const zero = LENSES.filter((l) => !count[l]);
const thin = LENSES.filter((l) => count[l] === 1);
const ok = LENSES.filter((l) => (count[l] || 0) >= 2);

console.log('PER-LENS COVERAGE (this session, 44 lenses)');
console.log('  2+ findings :', ok.length);
console.log('  1 finding   :', thin.length, thin.length ? '-> ' + thin.join(', ') : '');
console.log('  0 findings  :', zero.length, zero.length ? '-> ' + zero.join(', ') : '');

const bySev = {};
for (const f of [...session, ...harvested]) {
  const s = f.sev;
  bySev[s] = (bySev[s] || 0) + 1;
}
console.log('\nTOTAL FINDINGS');
console.log('  session    :', session.length);
console.log('  nightytidy :', harvested.length);
console.log('  combined   :', session.length + harvested.length);
console.log('  by severity:', JSON.stringify(bySev));

console.log('\nNEW CRITICALS FOUND THIS SESSION (post-correction pass):');
session
  .filter((f) => f.sev === 'critical')
  .sort((a, b) => RANK[a.sev] - RANK[b.sev])
  .forEach((f) => console.log(`  ${f.id}  ${f.file}:${f.line}\n       ${f.title}`));
