# Fix progress

Branch: `fix/wave-1-criticals` (off `phase-1-foundation`)
Plan: `FIX-PLAN.md` · Findings: `MERGED.json` · Regenerate: `node audit-reports/_harvest/plan.mjs`

450 open findings: 12 critical · 102 high · 192 medium · 144 low.

## Wave 1 — criticals (12)

| Finding | What | Status |
|---|---|---|
| S010 | `crypto.randomUUID` absent outside a secure context | **done** — `lib/id.ts` + 5 call sites, 4 tests |
| S001 | Backup import duplicated summary rows (mechanism corrected) | **done** — + `summaries.removeByBook`, 6 tests |
| S160 | Profile delete destroyed a library unguarded | **done** — `ConfirmProvider` raised, 3 tests |
| S166 | Profile creation failure silently swallowed | **done** |
| S081 | Fake "Privacy Mode — encryption" toggle | **done** — replaced with an accurate statement |
| S151 | GitHub Pages deploy impossible (no base / basename) | **done** — verified by build, see note |
| S091 | No navigation on phones | todo |
| F001 | No "Summarise this book" — imports are a dead end | todo |
| F003 | Due-card count never surfaced as a nav badge | todo |
| F004 | Generated audio never cached, re-bills every play | todo |
| F005 | `finishedAt` never written (also S024, S042) | todo |
| test-efficiency F001/F002 | jsdom per file; pool claim needs verifying first | todo |

### Notes carried forward

- **S001's stated mechanism was wrong** and was corrected only because a probe
  test disagreed with it. It never overwrote; it wrote a *second* summary row
  keyed on the backup's own id, which `getByBook` then resolved arbitrarily and
  `books.remove` only half-deleted. Worth re-probing any finding whose fix
  "passes" on the first try.
- **S090 was refuted** — Reset All *is* confirmed, via `ProfilePage`.
- **Windows/Git Bash mangles `BASE_PATH=/booksum/`** into a filesystem path
  (MSYS path conversion), silently producing `/Program Files/Git/booksum/...`
  in `dist/index.html`. Verify base-path builds from PowerShell, or the Linux CI.
- Bonus fix found by a new test: `ProfilePicker` snapshotted `isCreating` from an
  empty profile list, hiding every existing profile if it mounted before load.

## Waves 2-4

Not started. Wave 2 (high, 102) is dominated by three clusters: the dark-mode
codemod damage (~40 sites), unvalidated model JSON reaching IndexedDB (~15), and
mouse-only interactive elements (~5).
