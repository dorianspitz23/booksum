/**
 * Throwaway: does any element in src/ carry two Tailwind display utilities?
 * The last one wins, so a `flex hidden` reads as "hidden" while the author
 * plainly meant one of the two.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DISPLAY = new Set([
  'block',
  'inline-block',
  'inline',
  'flex',
  'inline-flex',
  'grid',
  'inline-grid',
  'hidden',
  'table',
  'contents',
]);

let hits = 0;

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full);
      continue;
    }
    if (!/\.tsx?$/.test(entry) || /\.test\./.test(entry)) continue;

    const source = readFileSync(full, 'utf8');
    for (const match of source.matchAll(/className=["`]([^"`]+)["`]/g)) {
      const found = (match[1] ?? '').split(/\s+/).filter((token) => DISPLAY.has(token));
      if (found.length > 1) {
        hits += 1;
        console.log(`${full}: ${found.join(' + ')}`);
      }
    }
  }
}

walk('src');
console.log(hits === 0 ? 'no conflicting display utilities anywhere in src/' : `${hits} conflicts`);
