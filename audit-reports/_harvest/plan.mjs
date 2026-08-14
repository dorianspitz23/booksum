import { readFileSync, readdirSync, writeFileSync } from 'node:fs';

const DIR = 'audit-reports/_harvest';
const RANK = { critical: 0, high: 1, medium: 2, low: 3 };

const session = readdirSync(DIR)
  .filter((f) => /^findings-session.*\.json$/.test(f))
  .flatMap((f) => JSON.parse(readFileSync(`${DIR}/${f}`, 'utf8')))
  .map((x) => ({ ...x, source: 'S' }));

const harvested = JSON.parse(readFileSync(`${DIR}/live-findings.json`, 'utf8')).map((x) => ({
  id: `${x.audit}/${x.id}`,
  sev: x.sev,
  lens: x.audit,
  file: x.file,
  line: x.line,
  title: x.title,
  detail: '',
  source: 'N',
}));

// Findings already fixed by the overnight auto-merge, verified by reading the code.
const ALREADY_FIXED = new Set([
  'type-safety/F002',
  'type-safety/F003',
  'type-safety/F004',
  'type-safety/RT-F001',
  'type-safety/RT-F002',
]);

const all = [...session, ...harvested]
  .filter((f) => !ALREADY_FIXED.has(f.id))
  .sort((a, b) => RANK[a.sev] - RANK[b.sev] || a.file.localeCompare(b.file) || a.line - b.line);

// Wave = severity. Within a wave, group by file so one edit pass closes many findings.
const waves = { critical: [], high: [], medium: [], low: [] };
for (const f of all) waves[f.sev].push(f);

const lines = ['# Fix plan — all findings, in waves by severity', ''];
lines.push('Status key: `[ ]` todo · `[x]` done · `[~]` partial · `[-]` refuted/not-a-bug', '');
lines.push(`Generated from ${all.length} open findings (5 already fixed by the overnight merge).`, '');

for (const sev of ['critical', 'high', 'medium', 'low']) {
  const items = waves[sev];
  lines.push(`## Wave ${RANK[sev] + 1} — ${sev} (${items.length})`, '');
  const byFile = {};
  for (const f of items) (byFile[f.file] ||= []).push(f);
  for (const [file, group] of Object.entries(byFile).sort((a, b) => b[1].length - a[1].length)) {
    lines.push(`### ${file} (${group.length})`);
    for (const f of group) lines.push(`- [ ] \`${f.id}\` L${f.line} — ${f.title}`);
    lines.push('');
  }
}

writeFileSync(`${DIR}/FIX-PLAN.md`, lines.join('\n'));

console.log('open findings:', all.length);
for (const sev of ['critical', 'high', 'medium', 'low']) {
  console.log(`  ${sev.padEnd(9)}: ${waves[sev].length}`);
}
console.log('\nWAVE 1 — the open criticals:');
waves.critical.forEach((f) => console.log(`  [${f.source}] ${f.id}  ${f.file}:${f.line}\n       ${f.title}`));
