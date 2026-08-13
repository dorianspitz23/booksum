# Audit state — type-safety

## Phase
COMPLETE — all 5 phases done, all deliverables written.

## Phase 5 COMPLETE — report.md + findings.json + waves.json written
**159 live findings** = 141 verified-live (148 raw − 7 refuted) + 18 NOVEL red-team.
The 17 overlapping red-team findings are attached to their counterparts as `corroborations` and
are NOT counted in any total.
Severity: critical 5, high 29, medium 64, low 61.
Wave plan: 12 waves / 12 sessions over 68 files, ceiling 18 findings per session, 0 unscoped.

Headline numbers were RE-MEASURED in Phase 5 against the AST rather than trusted from the stored
`assertionCensus` array (which disagreed with the RT04 summary — it double-counts and includes
test files). Authoritative, reproduced with `census-final.mjs`:
- 86 files / 8,418 lines (64 prod / 6,546 lines; 22 test / 1,872 lines)
- **0 explicit `any`, 0 `@ts-ignore`/`@ts-expect-error`/`@ts-nocheck`, 0 double-casts**
- 18 `as T` casts (17 prod + 1 test) = 2.1/kloc repo-wide, 2.6/kloc production
- 14 non-null assertions — **4 in production**, 10 in tests; 5 definite-assignments, all in tests
These confirm the Phase 1 / RT04 claims exactly. The `assertionCensus` array in redteam.json and
findings.json should NOT be re-summed for headline figures — use the numbers above.

Post-generation QA pass on report.md (the report is generated from findings.json, so it was
machine-checked rather than eyeballed). Verified: 0 un-interpolated template expressions, code
fences balanced, `<details>` balanced, all 159 ids referenced, 34 full entries (5 critical +
29 high) and 64 medium + 61 low compact entries with no gaps or duplicates, every section heading
present exactly once, and waves.json covering all 159.
FOUND AND FIXED: two markdown table rows were split by a literal `|` inside prose — TypeScript
union syntax (`Promise<string | null>` in the F084 refutation row, `Summary | undefined` in
Recommended Action 1). Both generators now escape `|` in every interpolated table cell. If these
scripts are ever re-run, keep that escape: union types appear in this finding set constantly.

Deviation from the phase chain: Phase 5 was completed in the MAIN THREAD rather than by a
dispatched report-writer subagent, because the resumed session carries an explicit instruction not
to use the Agent tool unless the user asks. The report-writer had been interrupted mid-draft by an
auth failure; its staged plain-language rewrites (159 entries, `C:\tmp\plain-{a,b,c,d}.json`) were
recovered and merged rather than regenerated.

## Audit type
type-safety

## Target
C:\Software Projects\BookSum\.worktrees\audit-type-safety

## Audited commit
01fa100764b1ae48b84a4d7b2b73ad3e0a8d28be (branch audit/type-safety, forked from phase-1-foundation)

## Spec
~/.claude/audit-types/type-safety.md

## Run mode
read-only — report.md + findings.json only. Fix suggestions go in findings.json `suggestedPatch`.
Never Edit/Write source, never commit source changes.

## Autonomous mode
on — drive every phase through to the Phase 5 report with no checkpoint.

## Started
2026-08-12T13:54:21Z

## Last updated
2026-08-13T07:56:20.245Z

## Phase 1 — lot discovery
Lots planned: 14 (see plan.json). Findings land in `findings/L<NN>.json`, one per lot.
Resume rule: re-read plan.json, list `findings/`, dispatch only the lots with no file yet.

Batch 1 done — 3/14 lots (L01=9, L02=13, L03=15 findings; 37 raw).
Batch 2 done — 6/14 lots (L04=3, L05=12, L06=9; 61 raw cumulative).
Batch 3 done — 9/14 lots (L07=8, L08=6, L09=11; 86 raw cumulative).
Batch 4 done — 12/14 lots (L10=6, L11=10, L12=17; 119 raw cumulative).
NOTE: batch 4 was dispatched twice — the first attempt lost L10 and L11 to transient network errors
(ENOTFOUND / connection closed) before either wrote output. Retried successfully. No duplicate data:
disk was validated between attempts (9 files, 86 findings, schema clean).
Batch 5 done — 14/14 lots (L13=15, L14=14).

## Phase 1 COMPLETE — validated on disk
148 raw findings across 14 lots. Schema validated: no parse failures, no count mismatches, no
missing `file`, no duplicate ids, all severities in the spec enum.
Per lot: L01=9 L02=13 L03=15 L04=3 L05=12 L06=9 L07=8 L08=6 L09=11 L10=6 L11=10 L12=17 L13=15 L14=14
Severity: critical=7, high=45, medium=62, low=34
Categories: boundary-without-validation=58, discriminated-union-opportunity=25,
branded-type-opportunity=21, tsconfig-strictness-gap=14, non-null-assertion=8,
type-assertion-as-T=7, untyped-public-function=5, unknown-misuse=4, generic-opportunity=3,
js-ambiguous-return=1, js-implicit-coercion=1, weak-type-as-Object-or-Function=1.
**ZERO findings in explicit-any-on-boundary, explicit-any-internal,
implicit-any-from-missing-annotation, ts-ignore-suppression, double-cast-as-unknown-as-T** —
the enumeration half of the audit is a confirmed null result. The report MUST lead with that.

## Phase 4 — red team (4 classes: RT01 lying-types, RT02 boundary-erasure, RT03 union/brand
## near-misses, RT04 assertion-clusters/permanent-unknown/compat-lock-in)
Spec classes deliberately NOT run, recorded here so the report can say so honestly:
**JSDoc rot** (no JS-only modules — the repo is all TS), **Python except-swallowing** and
**mypy/pyright ignore-lists** (no Python), **Generated types out of sync** (no codegen step;
the nearest analogue, the hand-written Gemini `responseSchema`, is covered by F031).
Deviation: the skill prescribes sequential dispatch; RT01/RT02 and RT03/RT04 were run as two
concurrent pairs to survive session rate limits. Classes were chosen to be maximally disjoint.

RT01 done — 12 findings (3 critical, 2 high, 7 medium). All runtime-crash claims proven in node.
  **RT-F001 is the headline: `createBookChatSession(book, summary): Chat` (`src/lib/ai/chat.ts:11`)
  is the codebase's only SYNCHRONOUS AI entry point and throws `MissingKeyError` when no key is
  stored, while its sole consumer calls it bare inside a `useEffect` (`ChatModal.tsx:37`). A
  keyless user clicking "Chat" escapes to react-router's `errorElement` and the entire app is
  replaced by the error screen — directly breaking the documented invariant "the app works with no
  key; only AI actions gate."**
RT02 done — 9 new findings + a **56-entry `boundaryInventory`** (the report should publish this as
  the definitive boundary map).
  - `src/lib/storage/db.ts:7`'s `DBSchema` declaration is the single assertion behind the whole
    repo.ts cluster, and the unvalidated import path (F022) can genuinely poison it permanently.
  - `ProfileContext.tsx:31` awaits the erased localStorage->IndexedDB migration unguarded on the
    boot path — one throw pins the app at the loading spinner with no in-app recovery.
  - **NEW CLASS OF FINDING: `vite/client` types `import.meta.env` as `Record<string, any>`**, so
    `import.meta.env.VITE_X.trim().nope()` assigned to a `number` compiles clean under `strict`.
    The repo's zero-`any` property therefore has an unannounced exception exactly where env vars
    would land. Verified with a tsc probe; fix is a three-line `vite-env.d.ts`.
  - Verified negatives worth publishing: NO `postMessage` / `BroadcastChannel` / `storage`-event /
    `structuredClone` / dynamic-`import()` / `process.env` boundaries anywhere in `src`;
    `useParams` is honestly typed `string | undefined` by react-router 8; the Goodreads CSV parser
    is genuinely total; and **`src/app/ErrorBoundary.tsx:5` is the one boundary in the repo done
    correctly** (`unknown` narrowed by `instanceof`) — cite it as the in-repo fix exemplar.

## Phase 4 COMPLETE — redteam.json written
4 classes: lying-types 12, boundary-erasure 9, union-and-brand-near-misses 6,
assertion-clusters-and-external-any 8. **35 total; 18 NOVEL, 17 flagged `overlapsExisting`.**
RT severity: critical 4, high 5, medium 21, low 5.
Extras carried into redteam.json: `boundaryInventory` (56 entries), `assertionCensus` (22 files),
`verifiedNegatives` (18).
**Phase 5 must count only the 18 novel RT findings as additions; the 17 overlapping ones are
already represented in verified.json and must NOT be double-counted in any total.**

### The 4 NOVEL critical/high red-team findings
- **RT-F001 [critical] `src/lib/ai/chat.ts:11`** — `createBookChatSession` typed total but throws
  `MissingKeyError`; its only consumer calls it bare inside `useEffect`, so the no-key path
  replaces the whole app with the error boundary. Breaks the documented "app works with no key".
- **RT-F002 [critical] `src/lib/storage/migrate.ts:80`** — `migrateLegacyData` declares
  `Promise<MigrationResult>` but rejects on malformed legacy data; `ProfileContext` awaits it with
  no catch, so the app hangs on the loading spinner forever AND re-duplicates data on every retry.
- **RT-F102 [high] `src/features/profile/ProfileContext.tsx:31`** — the boot path treats the erased
  localStorage->IndexedDB migration as infallible; one throw wedges the app forever.
- **RT-F005 [high] `src/lib/storage/db.ts:23`** — `getDb` memoizes the promise before it settles and
  never clears it on rejection, so ONE transient IndexedDB open failure permanently poisons every
  `Promise<T>` in the repo for the rest of the session.

### RT04's honest null result — the report must state this prominently
**There is no assertion cluster.** AST census: **18 `as T` casts (2.1 per kloc), ZERO double-casts,
only 4 non-null assertions in production code across 8,418 lines.** The `idb` / `@google/genai`
isolation invariant HOLDS by grep. Instead, four **library-sourced escape hatches** were each proven
with a tsc probe compiled against the repo's real node_modules under `strict: true`:
1. `@google/genai` types `responseSchema` as `Schema | unknown` -> all three AI response schemas are
   checked against nothing.
2. `vi.stubGlobal(value: unknown)` + bare `vi.fn()` (`Procedure = (...args: any[]) => any`) -> the
   matchMedia/fetch test mocks are unchecked.
3. `Promise.catch`'s `reason: any` defeats `noImplicitAny` at `AudioPlayer.tsx:29`.
4. The unannotated exported `routeTable` lets route-key typos (`errorElment`, `pathh`) compile.
(plus the already-filed `import.meta.env` = `Record<string, any>` from RT02.)
**This is the audit's real thesis: the danger is not what the authors wrote, it is what the type
system was never told, and what typed libraries hand back.**

## Phase 3 COMPLETE — verified.json written
All 148 findings verified across 10 batches (V01-V06 = 10 each; V07/V08 = 20 each; V09/V10 = 24
each — widened after a session rate limit at ~19:00 Europe/Budapest).
**byVerdict: 66 confirmed, 75 amended, 7 refuted, 0 uncertain. 141 live findings.**
**Severity BEFORE -> AFTER: critical 7->3, high 45->27, medium 62->54, low 34->57.**
52 demotions, 2 promotions, 6 recategorisations. Every live finding has a `suggestedPatch`.
Promotions: F072 (ReviewPage.tsx:76) and F107 (types.ts:88), both medium->high, both the
`correctAnswerIndex` unbounded Gemini->IndexedDB ingress.
**The report must use `effectiveSeverity` / `effectiveCategory`, NOT the raw Phase 1 values.**

### The 7 refuted findings (report in an appendix, excluded from the body)
F065 (200-row fixture has no cast; `as const` is narrowing; isbn13/dateRead genuinely optional),
F084 (`Promise<string | null>` is accurate — TS cannot express rejection in a return type),
F122 (test-side mirror of F123), F125 + F135 (abstractions with no duplicated type definition and
no call site needing narrowing), F127 (the two `!` are provably guarded at useFocusTrap.ts:45 and
would remain correct AND unremovable under noUncheckedIndexedAccess, since `items.at(-1)` is still
`| undefined`), F142 (narrowing persisted `Summary.model` would CREATE a lying type the moment
Google renames a model, since old IndexedDB rows keep the retired id).

### Phase 3 corrections from V09-V10 (canonical)
- F107 promoted medium->high: `correctAnswerIndex` flows unvalidated from `quiz.ts:16` through
  `srs.ts:29` into IndexedDB; an out-of-range index makes a review card permanently unanswerable
  AND daily-recurring.
- F106 held at medium with a NEW reachable failure Discovery missed: backup restore sets
  `hasPdf: true` with no blob, leaving a dead "Open Original PDF" button.
- F112 unreachable — the `reviewCards` store has ZERO external writers.
- F117's site list corrected: 6 of its 7 claimed unchecked-index sites produce NO error under the flag.
- All tsconfig measurements independently re-reproduced and hold exactly: noUncheckedIndexedAccess
  10, exactOptionalPropertyTypes 9, noPropertyAccessFromIndexSignature 5, noImplicitOverride 1,
  four zero-cost flags at 0, `--skipLibCheck false` = 2 node_modules-only errors.
  `no-undef: [0]` confirms ESLint does not backstop vitest globals leaking into production scope.
- F137's `cover_i=0` path is indistinguishable from the placeholder fallback it already produces;
  F139's missing-header case is already surfaced by GoodreadsImport's toast; F140 is a dead field
  on both ends rather than a validation gap.

## Phase 3 log (batches)
Resume rule: list `verifications/V*.json`, dispatch only the missing batches.
V01-V08 done — 100/148 verified: 40 confirmed, 58 amended, 2 refuted, 0 uncertain.
(V07/V08 were widened to 20 findings each after a session rate limit; V09/V10 cover F101-F148.)

### Phase 3 corrections from V07-V08 (canonical)
- **F072 amended UP to high** — quiz `correctAnswerIndex` is unbounded Gemini->IndexedDB ingress.
  `schemas.ts:69-72` puts the "0-3" constraint in a prose `description` string while `genai.d.ts`
  exposes unused `minimum`/`maximum`. An out-of-range index makes a review card permanently
  unanswerable-correctly at `ReviewPage.tsx:76/94` with NO crash to signal it.
- **F089 MEASURED**: `npx tsc --noEmit --noUncheckedIndexedAccess` yields **exactly 10 errors
  project-wide, all in 4 component files, ZERO in `src/lib/**`** — the flag is a cheap win. This is
  the single most actionable config recommendation; lead the strictness section with it.
- **REFUTED F065** — the 200-row test fixture has no cast at all (`as const` is narrowing) and
  `isbn13`/`dateRead` are genuinely optional at `goodreads.ts:7-8`. Valid `GoodreadsRow`, not a
  lying fixture. Residue is test-coverage, not type safety.
- **REFUTED F084** — `Promise<string | null>` accurately describes every resolution; TypeScript
  cannot express rejection in a return type. The claimed "lying signature" is inexpressible, not
  weakened.
- **F099 impossible**: `ProfileView.tsx:239` is `<input type="range" min="1" max="20">`, which has
  no empty state, so `parseInt` cannot yield NaN. No other persisted path produces a non-finite
  number.
- **F093 unreachable**: the RangeError reproduces at exactly 14 consecutive Easy grades, but
  `listDue` gates each review on the previous interval — that needs ~325,000 years of wall clock.
- F063 mechanism corrected but HELD: the SVGAElement rationale is false (zero inline anchors, zero
  `tabIndex`), but `AddBookModal.tsx:229`'s `display:none` file input really is the last focusable
  when the submit button is disabled, so Tab escapes the modal.
- F078 refuted-in-spirit (amended to low): a prompt-injection premise crosses no privilege boundary
  in a local-first single-user app.
- Standing pattern confirmed at scale: 12 of 20 in V08 dropped medium->low as duplicates,
  schema/test-side mirrors, or branded-type recommendations with no wrong call site.

### Phase 3 corrections from V04-V06 (canonical)
- Blast-radius counts in Phase 1 were **inflated ~40% by counting test files**. Real non-test call
  sites: books 14, profiles 9, blobs 5, summaries 8. Phase 5 must use these numbers.
- V05 collapsed its 10 findings into **3 distinct defects** (F043 the shipped migration bug, F044
  the `??`-as-validation legacy-JSON boundary, F048 the unvalidated backup-import write path) plus
  F050 as their shared type-level cause. Do not report 10.
- F059's mechanism was wrong in a way that makes it WORSE: `migrate.ts:105-119` omits
  `oneSentenceTakeaway` entirely, so the library/detail contradiction is **deterministic for 100% of
  migrated legacy books**, not the conditional `''` case reported.
- F037's claim that the legacy app stored PDFs as `data:...;base64,` is verifiably WRONG —
  `670b5fe:components/AddBookModal.tsx:28` strips the prefix via `.split(',')[1]`. The boot-hang
  trigger needs a corrupted/hand-edited localStorage value, not a normal upgrade.
- F049 measured: `new Blob([{}])` really does yield a 15-byte "[object Object]" with a valid PDF
  MIME, BUT `blobs.put` (repo.ts:129-140) is the ONLY writer and always calls `blob.arrayBuffer()`,
  so no in-app path produces it — defense-in-depth, not a live bug.
- F046: sort never invokes the comparator on a single-profile store, and the legacy app only ever
  wrote `joinedAt` as an ISO string — boot hang needs a hand-edited store.
- F053/F057/F060 amended down to low: `useFocusTrap.ts:45` guards the two "unguarded" production
  `!` (also provable no-ops under this tsconfig), and both FileReader findings rest on an
  abort/error scenario that never routes to `onload`.
- Proven with the repo's own tsc: `satisfies Schema` compiles unchanged on the current schema
  literals and catches the `properites`-typo class (F031, confirmed high). That is the recommended
  fix shape for the unchecked `responseSchema` problem.
- Standing pattern: many Phase 1 findings are **test-side or schema-side mirrors** of a defect
  already counted on its producer file. Verifiers are amending these down. Phase 5 must not
  re-inflate them.
Zero refutations so far is NOT rubber-stamping: 17 substantive amendments (severity recalibration +
corrected root causes), each citing current line numbers and several proven by execution.

### Phase 3 corrections that OVERRIDE Phase 1 claims (canonical — the report must use these)
- **Only 3 of the 7 Criticals survive.** F002/F003 (the `summary!` defect, caller and callee sides,
  proven end-to-end to blank the app for every Goodreads-imported book) and F004 (unvalidated
  `as LibraryExport`; reachability STRENGTHENED — the original app at commit `670b5fe` shipped a
  `version: 1` export with inline base64 PDFs, which today's import would write straight into the
  books store). The other four dropped to high/medium.
- **F006/F007 downgraded**: the claimed "obvious" malformed-localStorage shapes are refuted by
  `670b5fe:components/AddBookModal.tsx:28` (strips the data-URL prefix, stores raw base64) and
  `670b5fe:App.tsx:212` (always writes a JSON array). The "permanent brick" needs DevTools, not a
  user action.
- **CORROBORATED INDEPENDENTLY BY TWO VERIFIERS (V02 and V03):** the `saveSummary` backfill at
  `useLibrary.tsx:82-83` is **dead code** — its only caller returns early when there is no summary.
  So F011/F021's claimed route is unreachable. BUT the bug is real via a producer both discoverers
  missed: `migrate.ts:105-119` persists `summaryId` while omitting `oneSentenceTakeaway` from the
  same `books.create` call, so every legacy-migrated book renders "Not summarised yet" at
  `BookCard.tsx:89` while the detail page shows the real takeaway. `migrate.test.ts:96-105` asserts
  `summaryId` but never the takeaway.
- Proven by execution: a StoryGraph-shaped CSV header imports every row as `author: 'Unknown'` /
  `'Want to Read'` / rating 0 with `skipped: 0`; a whitespace-only detailed summary yields
  `pages[0] === undefined` plus a "Infinity% Complete" render.
- F017/F018 and several others were double-counting one boundary defect each (transient/test-side
  mirrors) — amended down to medium. Phase 5 must not re-inflate them.

## Phase 2 COMPLETE — aggregate.json written
148 raw -> **148 after dedup** (0 merges, 100% retained). This is honest, not under-eager dedup:
a corpus-wide similarity sweep found **zero** finding pairs above 0.30 Jaccard on title+description.
The lots produced non-overlapping findings because each batch's prompt explicitly forbade
re-reporting earlier lots' root causes (consumer-side consequences were reported separately, and
those anchor on different files, so the conservative same-file+line±2+category rule correctly
declined to merge them).
Severity: critical=7, high=45, medium=62, low=34. Zero normalization issues (all categories and
severities were already spec-valid).
Carried into aggregate.json as top-level extras for the Phase 5 report:
`strictFlagMeasurements` (from L01) and `fileDensity` (from L11).
Dedup audit trail: `dedup-log.txt`.

### Theme census (for Phase 5 grouping; informational, findings may appear in >1 theme)
unvalidated-model-json=32 · strict-flags=29 · migrate-boot=21 · summary-optional-lie=15 ·
errors-misclassify=12

### Batch 5 facts (canonical)
- `errors.test.ts:4` `apiError(status, message = 'boom')` makes the whole 400/401/403 `it.each`
  table pass on a message matching NO branch — the 403 referrer-block misclassification ships green.
  This is the archetypal "green test that proves nothing" finding.
- BOTH known `migrate.ts` bugs are uncatchable by `migrate.test.ts`'s fixtures. Escalation: because
  `MIGRATION_MARKER` is written LAST while `ProfileContext.tsx:31` awaits it before
  `setIsLoading(false)` (line 41) inside an uncaught `void (async…)()`, a throw hangs boot
  PERMANENTLY on every reload. Rated critical.
- `routing.test.tsx` is the ONLY test mounting the real `BookDetail`; its fixture book has no
  `summaryId` and it asserts only `window.location.pathname` — stopping exactly one click short of
  the `summary!` crash.
- `saveSummary` is called by ZERO tests; the one summary test pre-seeds `readingTimeMinutes: 12` and
  never asserts the denormalised pair.
- `books.create`'s `{...input}` + spread-suppressed excess-property checking lets an unvalidated
  `LibraryExport` book carry binary fields into IndexedDB via `useLibrary.tsx:111`.
- `src/lib/ai`: 11 modules, 2 test files, all four `JSON.parse(...) as T` boundaries untested.
  `summarize.ts:36`'s `?? []` cannot coerce a non-array, and `markdown.ts:24` then `.map()`s it.
- Verified negatives: no fake/partial context values anywhere (every test wraps the REAL
  ProfileProvider/LibraryProvider — the `mockUser as User` pattern does not occur); no `vi.mock`
  module factories at all; `wav.test.ts`, `contrast.test.ts` sound; `markdown.test.ts` and
  `srs.test.ts` use the honest-fixture pattern; the `parseGoodreadsCsv` block is the strongest suite.

### Cross-lot facts established in batch 4 (canonical)
- **CORROBORATED CRITICAL (found independently by L11 and L12):** `BookDetail.tsx:534/536` passes
  `summary!` (a `Summary | undefined`) to ChatModal/QuizModal, which both declare `summary: Summary`
  as REQUIRED. The Chat/Quiz buttons are gated only on `!isPreview` (BookDetail.tsx:337), never on a
  summary existing. Clicking Chat on any unsummarised (e.g. Goodreads-imported) book reaches
  `chatSystemInstruction`'s `${summary.oneSentenceTakeaway}` inside a useEffect with no try/catch →
  throw escapes to the error boundary and takes the app down. `DailyWisdomModal` models
  `summary: Summary | undefined` correctly — the direct in-repo counterexample proving the fix shape.
- `ProfileView.tsx:117` asserts arbitrary file JSON to `LibraryExport` behind a single
  `Array.isArray(data.books)` check, then writes straight to IndexedDB (zero runtime validation) →
  malformed backup persists half-imported corrupt records durably.
- `ProfileView.tsx:46` real data-loss bug: the edit draft is a never-resynced `useState(profile)`
  snapshot typed identically to the live record, so saving the bio after using ThemeToggle silently
  reverts the persisted theme.
- `ReviewPage.tsx:93`: an unvalidated `ReviewCard.options: []` permanently deadlocks the review
  session (zero option buttons → `selected` stays null → grade buttons never render → `grade()` is
  the only thing that advances the queue → `listDue`'s `dueAt` sort returns the same card after
  reload, so every card behind it is unreachable).
- `correctAnswerIndex` is never bounds-checked but is only ever COMPARED, never used to index — so
  it degrades silently (card can never be answered correctly) rather than crashing. Amend severity
  accordingly; do not overstate as a crash.
- `saveSummary` (useLibrary.tsx:82-83) writes only `summaryId`, so a summarised Goodreads import
  still renders "Not summarised yet" beside "0 min read" on BookCard. Confirmed end-to-end.
- Verified negatives to record as intentional good patterns: `useBookRoute` types
  `book: Book | undefined` honestly and both pages guard it (`/book/does-not-exist` redirects
  cleanly); `useTheme` never touches localStorage at all (theme lives on the Profile record in
  IndexedDB — the lot brief's premise was wrong); `ProfileContext` default is honestly `| undefined`
  with a throwing hook; `ApiKeyDialog` validates via a live API round-trip; `StatsView` is NaN- and
  reduce-safe; `toastStore` is soundly typed (literal union, `Set<() => void>`, correct
  `useSyncExternalStore` contract); `AudioPlayer` guards every ref access; `ConfirmDialog`'s
  resolver ref is correctly nullable; ProfileView has NO `as Profile` partial-update trap (correct
  spreads); EReader has NO DOM casts and its reader settings are already proper literal unions.
- Non-type observation carried in L11-F09's description: object URLs at BookDetail.tsx:160/199 and
  EReader.tsx:204 are never revoked (leak).
- `lib/ai/apiKey.ts` duplicates `toastStore.ts`'s store shape byte-for-byte — generic-opportunity.

### Cross-lot facts established in batch 3 (canonical)
- L08 lot is exceptionally clean: ZERO type assertions / non-null assertions in the whole app-shell
  lot. `main.tsx` throws explicitly instead of `getElementById('root')!`; `ShellContext.ts` uses the
  textbook `createContext<ShellApi | undefined>(undefined)` + throwing `useShell()`; `ErrorBoundary`
  narrows with `instanceof Error` rather than casting. Record these as intentional good patterns.
- Confirmed consumer-side of the errors.ts bug: `AppShell.tsx:53` `setShowKeyDialog(true)` is the
  app's ONLY path to the key dialog, so a referrer-blocked 403 leaves the user with NO recovery.
  The `if` over an 8-member union has no `assertNever`.
- react-router 8's `ErrorResponseImpl` does NOT extend `Error`, so every unmatched URL renders the
  generic "An unexpected error occurred." (traced through router source).
- `routeTable` lacking a `RouteObject[]` annotation disables excess-property checking — proven with
  the repo's own tsc (annotated literal errors TS2561 on a typo'd `errorElement`; unannotated
  compiles silently).
- `scheduleCard` declares `: ReviewCard` but throws RangeError once ease/interval go non-finite;
  14 consecutive Easy grades overflows the Date range (verified by simulation).
- `base64ToBytes` declares a total `(string) => Uint8Array` but `atob` throws on malformed input
  from `JSON.parse(localStorage) as LegacyBook[]`, with no try/catch up to ProfileContext — strands
  the app on loading AND re-runs the "one-time" migration into duplicate profiles every reload.
- `wav.ts` header arithmetic is byte-for-byte correct vs the RIFF/WAVE spec; `markdown.ts` is
  entirely clean (no regex at all — the hypothesised capture-group hazard does not exist);
  `download.ts` revokes its object URL. Verified negatives.
- `repo.ts:88` uses a lexicographic `dueAt` compare that disagrees with `isDue`'s `Date.parse`
  compare — cross-cutting, flag for red team.
- `useLibrary`'s untagged `{ books, isLoading }` bag is ignored by 4 of its 6 consumers → false
  "Your library is quiet" empty state on every cold load.
- File-input boundary is clean (`files?.[0]` + `if (!file) return`); profile-loading gotcha is
  honored twice over. Verified negatives.

### Cross-lot facts established in batch 2 (canonical; do not re-derive)
- `@google/genai` isolation invariant HOLDS (imports only in src/lib/ai/{client,chat,tts,schemas}.ts).
- "Goodreads import makes zero AI calls" invariant HOLDS airtight, with a standing regression test
  at `src/lib/covers/index.test.ts:63`. Import path makes zero network calls at all.
- `apiKey.ts`, `models.ts`, `client.ts`, `prompts.ts` are genuinely CLEAN — verified negatives.
- Gemini `responseSchema` has SDK type `SchemaUnion = Schema | unknown`, so the schema constants in
  `schemas.ts` get NO compile-time checking. They are the only enforcement layer and there is zero
  runtime validation at all four parse sites.
- `src/lib/ai` has tests only for `apiKey` and `errors` — every parse boundary there is untested.
- Headline defects from batch 2: `errors.ts` `toAiError` substring-matches the SDK message BEFORE
  checking the typed `ApiError.status`, so a 403 referrer-block maps to `safety` not `invalid-key`
  (AppShell.tsx:49 never opens the key dialog) and every 429 maps to `quota` not `rate-limited`
  (429 branch is dead code; its unit test passes only because the fixture message is `'boom'`).
  `statusOf` asserts `unknown` to object and throws TypeError on null/undefined.
  `quiz.ts:16` casts model JSON to required-field `QuizQuestion[]`; QuizModal persists it as
  ReviewCards, and a missing `options` bricks /review via ReviewPage.tsx:93 with no per-card delete
  to recover.

## Baseline facts (established Phase 0, main thread)
- `npx tsc --noEmit` in the audit worktree exits **0 — clean**. The codebase compiles green under
  its CURRENT config, so every finding in this audit is by definition something the current
  configuration does not catch. Report must frame it that way.
- `tsconfig.json` has `strict: true` but is missing `noUncheckedIndexedAccess` and
  `exactOptionalPropertyTypes` (per the Phase 0 planner's config read).
- Scripts available: `typecheck` (tsc --noEmit), `lint` (eslint .), `test` (vitest run),
  `format:check`. All runnable inside the worktree; node_modules is populated (206 entries).

### Measured in Phase 1 / L01 — treat as canonical, do not re-derive
- The repo contains **zero `any`** and **zero `@ts-ignore`/`@ts-expect-error`**. ESLint's
  `no-explicit-any` and `ban-ts-comment` are active and clean. So the enumeration half of this
  audit is a NULL RESULT — the report must say so plainly and pivot to lying types, boundary
  erasure, and discriminated-union/branded-type gaps.
- Every `strict` sub-flag (incl. `strictNullChecks`) measures **0 errors** — the codebase is
  genuinely null-aware. No multi-week migration is implied. Opt-in flags total **25 errors across
  11 of 86 files**: noUncheckedIndexedAccess 10, exactOptionalPropertyTypes 9,
  noPropertyAccessFromIndexSignature 5, noImplicitOverride 1. Four more flags are 0 = free ratchets.
- **ESLint has no `parserOptions.project`/`projectService`**, so the entire type-aware
  `@typescript-eslint` tier (`no-unsafe-*`, `no-unnecessary-type-assertion`, `no-floating-promises`)
  is INERT and cannot fire over the unvalidated `JSON.parse`-to-domain-type casts. This is the
  highest-leverage config finding.
- CI does gate `npm run typecheck` (twice). `vite.config.ts` does NOT weaken test types.
  `skipLibCheck: true` is load-bearing (hides only an uninstalled optional peer dep + absent jest
  types), so it is documentation-only, not a defect.
- Headline defects so far: `migrate.ts:58` `JSON.parse(raw) as T` on the unguarded boot path can
  permanently brick boot (migration marker written only after the loop); `migrate.ts:105` sets
  `summaryId` without the denormalised `oneSentenceTakeaway`, so migrated books render
  "Not summarised yet" — a confirmed user-facing bug.

## Notes
- Unattended scheduled run; no human available. Never park waiting for input.
- Main checkout is at `C:\Software Projects\BookSum` on branch `phase-1-foundation`. The audit
  worktree at `.worktrees/audit-type-safety` is on branch `audit/type-safety` at the same commit.
- Deliverables dir has NO run-id subdirectory: artifacts live directly in
  `<auditRoot>/audit-reports/audit-type-safety/`. This matches the orchestrator's phase-chain
  table and the run's stated final deliverable path.
- Deviation: `.worktrees/` was not in the tracked `.gitignore`. Rather than modify a tracked file
  in the main checkout during a read-only audit, `.worktrees/` was added to the local-only
  `.git/info/exclude`. Verified ignored via `git check-ignore -v`. Reversible; touches nothing
  tracked.
- A second audit worktree exists at `.worktrees/audit-file-decomposition` (different audit type,
  no state.md found). No conflict with this run.
- `node_modules` was copied into the worktree in the background so Phase 1/3 can run the real
  `tsc --noEmit`. Subagents must NEVER run `npm install` (a junction/copy mishap could mutate the
  main checkout).
