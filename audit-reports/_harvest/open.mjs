/**
 * Lists still-open findings at a given severity.
 * Usage: node audit-reports/_harvest/open.mjs high [limit]
 *
 * "Open" means no commit on this branch mentions the finding id. That is a
 * proxy, not proof -- a fix landed without citing its id reads as open here.
 * Reads the same two sources, id pattern and base ref as closed.mjs.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';

const sev = process.argv[2] ?? 'high';
const limit = Number(process.argv[3] ?? 40);
const D = 'audit-reports/_harvest';

const session = readdirSync(D)
  .filter((f) => /^findings-session.*\.json$/.test(f))
  .flatMap((f) => JSON.parse(readFileSync(`${D}/${f}`, 'utf8')));

// Fixed by the overnight auto-merge before this branch existed.
const ALREADY = new Set(['F002', 'F003', 'F004', 'RT-F001', 'RT-F002']);

const harvested = JSON.parse(readFileSync(`${D}/live-findings.json`, 'utf8')).filter(
  (x) => !ALREADY.has(x.id)
);

const log = execSync('git log phase-1-foundation..HEAD --pretty=%B', { encoding: 'utf8' });
const mentioned = new Set(log.match(/\b(?:S\d{3}|RT-F\d{3}|F\d{3})\b/g) ?? []);

const open = [...session, ...harvested].filter((f) => f.sev === sev && !mentioned.has(f.id));

console.log(`${open.length} open "${sev}" findings\n`);
for (const f of open.slice(0, limit)) {
  const where = f.file ? `${f.file}${f.line ? `:${f.line}` : ''}` : '—';
  console.log(`${f.id}  [${f.lens ?? '?'}]  ${where}`);
  console.log(`    ${(f.title ?? f.what ?? f.summary ?? '').slice(0, 160)}`);
}
