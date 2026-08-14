# Fix progress

Branch: `fix/wave-1-criticals` (off `phase-1-foundation`)
Plan: `FIX-PLAN.md` · Findings: `MERGED.json` · Regenerate: `node audit-reports/_harvest/plan.mjs`

450 open findings: 12 critical · 102 high · 192 medium · 144 low.

## Wave 1 — criticals: 12 of 12 done

| Finding | What | Status |
|---|---|---|
| S010 | `crypto.randomUUID` absent outside a secure context | done — `lib/id.ts`, 5 call sites, 4 tests |
| S001 | Backup import duplicated summary rows (mechanism corrected) | done — + `summaries.removeByBook`, 6 tests |
| S160 | Profile delete destroyed a library unguarded | done — `ConfirmProvider` raised, 3 tests |
| S166 | Profile creation failure silently swallowed | done |
| S081 | Fake "Privacy Mode — encryption" toggle | done — replaced with an accurate statement |
| S151 | GitHub Pages deploy impossible (no base / basename) | done — verified by real build |
| F005 | `finishedAt` never written (also S024, S042, S083, S089) | done — `lib/stats.ts`, 15 tests |
| F001 | No "Summarise this book" — imports were a dead end | done — + S038, 6 tests |
| S091 | No navigation on phones | done — bottom nav below `sm` |
| F003 | Due-card count never surfaced | done — queue is now a provider; + S104, S105 |
| F004 | Narration never cached, re-billed every play | done — + S036/S037/S093 leaks, 7 tests |
| test-efficiency F002 | Uncapped worker pool | done — `maxWorkers: 4` |

**Partial:** test-efficiency F001 (jsdom built for all 28 files, including those
with no DOM). The pool cap removed the observed flakiness, but the environment
split itself is untouched — several suites need `localStorage`, so moving them to
the node environment is not a one-line change. Carried into Wave 2.

Gate: typecheck clean · lint clean · **217 tests passing** · build clean.

### Notes carried forward

- **S001's stated mechanism was wrong** and was corrected only because a probe
  test disagreed with it. It never overwrote; it wrote a *second* summary row
  keyed on the backup's own id, which `getByBook` resolved arbitrarily and
  `books.remove` only half-deleted. Re-probe any finding whose fix passes first try.
- **S090 refuted** — Reset All *is* confirmed, via `ProfilePage`.
- **The Blob constructor lowercases `type`.** The narration cache tagged the
  voice as `voice=Kore` and read back `voice=kore`, so the cache never hit. Only
  the test caught it.
- **Windows/Git Bash mangles `BASE_PATH=/booksum/`** into a filesystem path.
  Verify base-path builds from PowerShell, or in the Linux CI.
- Bonus fix from a new test: `ProfilePicker` snapshotted `isCreating` from an
  empty profile list, hiding every existing profile if it mounted before load.

## Waves 2-4 — not started

438 findings. Wave 2 (high, 102) is dominated by three clusters:

1. **Dark-mode codemod damage** (~40 sites) — opacity stranded on the dark half,
   `dark:` appended after arbitrary-variant selectors, hardcoded dark surfaces
   used as selected states. Several primary buttons vanish in one theme.
2. **Unvalidated model JSON reaching IndexedDB** (~15) — root cause is upstream
   in `schemas.ts`: `minItems`/`maxItems`/`minimum` are expressed as prose
   descriptions rather than constraints (S141-S144).
3. **Mouse-only interactive elements** (~5) — `BookCard`, `StatCard`, the PDF
   drop zone. `RecommendationCarousel` is the in-repo reference implementation.
