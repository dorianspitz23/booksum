import { readFileSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';

const D = 'audit-reports/_harvest';

const session = readdirSync(D)
  .filter((f) => /^findings-session.*\.json$/.test(f))
  .flatMap((f) => JSON.parse(readFileSync(`${D}/${f}`, 'utf8')));

// Fixed by the overnight auto-merge before this branch existed.
const ALREADY = new Set(['F002', 'F003', 'F004', 'RT-F001', 'RT-F002']);

const harvested = JSON.parse(readFileSync(`${D}/live-findings.json`, 'utf8')).filter(
  (x) => !ALREADY.has(x.id),
);

const log = execSync('git log phase-1-foundation..HEAD --pretty=%B', { encoding: 'utf8' });
const mentioned = new Set(log.match(/\b(?:S\d{3}|RT-F\d{3}|F\d{3})\b/g) ?? []);

const all = [
  ...session.map((f) => ({ id: f.id, sev: f.sev })),
  ...harvested.map((f) => ({ id: f.id, sev: f.sev })),
];

const done = {};
const total = {};
for (const f of all) {
  total[f.sev] = (total[f.sev] || 0) + 1;
  if (mentioned.has(f.id)) done[f.sev] = (done[f.sev] || 0) + 1;
}

let doneAll = 0;
console.log('Findings addressed on this branch (by commit-message reference)\n');
for (const sev of ['critical', 'high', 'medium', 'low']) {
  const d = done[sev] || 0;
  doneAll += d;
  console.log(`  ${sev.padEnd(9)} ${String(d).padStart(3)} / ${total[sev] || 0}`);
}
console.log(`\n  TOTAL     ${doneAll} / ${all.length}`);
console.log(`\n  distinct ids referenced in commits: ${mentioned.size}`);
