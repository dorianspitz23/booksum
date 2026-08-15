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

## Wave 2 — high (102): in progress, ~21 closed

**AI layer, closed:** S141-S144 (schema constraints stated as constraints, not
prose) · S062/S106/S032 (runtime validation before persistence) ·
S003/S004/S005/S139 (error mapper: status before message) · S016 (timeouts) ·
S015 (key check no longer costs an inference) · S034/S035 (no more success-typed
failure sentinels) · S033 (one bad cover no longer discards six recommendations)
· S064/S065/S066/S071 (PDF limit enforced, drop zone keyboard-reachable).

**test-efficiency F001, closed** — and it mattered more than it looked:

> `setup.ts` imported jest-dom and testing-library at module scope, so every one
> of 29 suites built a jsdom window, including the 13 that touch no DOM. On a
> loaded machine (100% CPU, ~1GB free) **11 of 29 files failed to start their
> worker and never ran.** Vitest *does* exit non-zero in that state, so it is not
> a silent-green CI hazard — but the summary line reads `Test Files 18 passed
> (18)`, counting only what ran, so the shortfall is easy to miss at a glance.
> After guarding the setup imports and marking the pure suites
> `@vitest-environment node`: all 29 run, 2514s → 126s under the same load.

**Verification caveat:** any green result recorded before commit `eec30d2` was
taken with this hazard present. Reruns since show `29 passed (29)`, which does
mean all 29 ran — the parenthesised total counts files that started, so a
shortfall would have shown as a smaller number plus an `Errors` line.

### Wave 2, later batches

- **Storage layer** — cascades are one transaction, card lookups are index-backed
  (`DB_VERSION` bumped), DB-open failure surfaces instead of hanging.
- **Legacy JSON shape** — `readJson<T>()` was an assertion, not a check. A profile
  key holding a string, or a library key holding an object, was handed downstream
  as a typed value; the object case threw out of `for...of` and aborted the whole
  migration. Now `unknown` + per-call-site checks, 5 new tests.
- **No page load contacts a third party.** Fonts self-hosted via `@fontsource`
  (was `fonts.googleapis.com`). Tailwind's auto source detection was scanning
  `audit-reports/`, whose JSON quotes class names verbatim — enough to emit a rule
  embedding a `transparenttextures.com` URL for a class no element uses. Scanning
  is now `source(none)` + explicit `@source`. The only `https://` left in `dist/`
  is Tailwind's own licence banner.
- **Theme** — applied in `App`, not `AppShell` (which never renders on the picker
  screen), plus a pre-paint inline script reading a localStorage mirror, so dark
  mode no longer flashes white. Profile record stays the source of truth.
- **Cover fetches** — shared `fetchJsonOrNull` with an 8s abort; a hung provider
  used to leave the add-book spinner running forever, 6 tests.

**Three tests replaced that could not fail.** Each looped over a fetch spy's
recorded calls asserting none hit the Gemini host — zero calls means zero
assertions. The Goodreads path issues no fetch at all, so the loop body never
ran. Now asserted against `getClient`, with the mock delegating to the real
implementation so it observes without changing behaviour. **Falsification was
checked**: injecting a `getClient()` call into `importGoodreadsRows` fails
exactly that test.

## Waves 2 (remaining) - 4

438 findings. Wave 2 (high, 102) is dominated by three clusters:

1. **Dark-mode codemod damage** (~40 sites) — opacity stranded on the dark half,
   `dark:` appended after arbitrary-variant selectors, hardcoded dark surfaces
   used as selected states. Several primary buttons vanish in one theme.
2. **Unvalidated model JSON reaching IndexedDB** (~15) — root cause is upstream
   in `schemas.ts`: `minItems`/`maxItems`/`minimum` are expressed as prose
   descriptions rather than constraints (S141-S144).
3. **Mouse-only interactive elements** (~5) — `BookCard`, `StatCard`, the PDF
   drop zone. `RecommendationCarousel` is the in-repo reference implementation.
