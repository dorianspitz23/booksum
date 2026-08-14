import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const DIR = 'audit-reports/_harvest';
const RANK = { critical: 0, high: 1, medium: 2, low: 3 };

// 1. This session's findings, spread across findings-session*.json
const sessionFiles = readdirSync(DIR)
  .filter((f) => /^findings-session.*\.json$/.test(f))
  .sort();

const session = sessionFiles.flatMap((f) =>
  JSON.parse(readFileSync(`${DIR}/${f}`, 'utf8')).map((x) => ({
    id: x.id,
    sev: x.sev,
    lens: x.lens,
    file: x.file,
    line: x.line,
    title: x.title,
    detail: x.detail,
    source: 'session',
  })),
);

// 2. Findings recovered from the NightyTidy runs that completed a verify phase
const harvested = JSON.parse(readFileSync(`${DIR}/live-findings.json`, 'utf8')).map((x) => ({
  id: `${x.audit}/${x.id}`,
  sev: x.sev,
  lens: x.audit,
  file: x.file,
  line: x.line,
  title: x.title,
  detail: '',
  source: 'nightytidy',
}));

const all = [...session, ...harvested].sort(
  (a, b) => RANK[a.sev] - RANK[b.sev] || a.file.localeCompare(b.file),
);

// 3. Overlap: same file within 6 lines, both sources. Indicates independent confirmation.
const overlaps = [];
for (const s of session) {
  for (const h of harvested) {
    if (s.file === h.file && Math.abs((s.line ?? 0) - (h.line ?? 0)) <= 6) {
      overlaps.push(`${s.id} <-> ${h.id}  ${s.file}:${s.line}`);
    }
  }
}

const bySev = {};
const byFile = {};
for (const f of all) {
  bySev[f.sev] = (bySev[f.sev] || 0) + 1;
  byFile[f.file] = (byFile[f.file] || 0) + 1;
}

writeFileSync(`${DIR}/MERGED.json`, JSON.stringify(all, null, 1));

console.log('session files merged :', sessionFiles.join(', '));
console.log('session findings     :', session.length);
console.log('nightytidy findings  :', harvested.length);
console.log('TOTAL                :', all.length);
console.log('by severity          :', JSON.stringify(bySev));
console.log('independent overlaps :', overlaps.length);
console.log('\nTop files by finding count:');
Object.entries(byFile)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 12)
  .forEach(([f, n]) => console.log(`  ${String(n).padStart(3)}  ${f}`));
console.log('\nCriticals:');
all
  .filter((f) => f.sev === 'critical')
  .forEach((f) => console.log(`  [${f.source}] ${f.id}  ${f.file}:${f.line}\n        ${f.title}`));
