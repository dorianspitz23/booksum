# File Decomposition Audit Report — BookSum

_Completed: 2026-08-12T16:27:30.396Z_
_Target: `C:\Software Projects\BookSum\.worktrees\audit-file-decomposition`_

## Executive summary

Ninety-four files were inventoried across the repository; 64 are in scope for decomposition, and only **three** of them exceed 300 lines — `src/components/BookDetail.tsx` (539), `src/components/EReader.tsx` (477) and `src/components/ProfileView.tsx` (439). Exactly one in-scope file exceeds 500 lines, none exceeds 1,000, and the only file over 1,000 lines anywhere in the repo is the generated `package-lock.json`. Twelve findings survived to this report — **0 critical, 0 high, 3 medium, 9 low** — with one discovery finding refuted; thirteen files are documented as inherently monolithic. The three split candidates, in order of impact: extract the markdown renderer from `BookDetail.tsx` (539 → ~450 after step 1, the one clean responsibility boundary in the repo); extract the backup/restore surface from `ProfileView.tsx` (439 → ~306, **once, not twice**); and `EReader.tsx` (477), where this report recommends **against** the proposed split — see the adjudication of F004 versus RT-F005. The codebase has a deliberate, consistently-applied **mixed** module organisation — layer-based at the top (`src/app`, `src/lib`, `src/components`, `src/features`), domain-based one level down inside `src/lib`, feature-based inside `src/features` — with **partial** barrel usage (exactly one barrel file) and **zero** path aliases, so every recommended split lands as a flat sibling in the directory it came from and introduces no new pattern.

### Three caveats that govern how this report should be read

**1. There is no test safety net for any of the split candidates.** `src/components/` contains **10 source files and zero test files** — including all three of the repo’s largest files. The spec’s discipline of "one file at a time, full test suite after every split" has nothing to run for these files. Repo-wide the co-located-test convention otherwise holds well (20 of 21 test files sit beside their subject, 17 as exact stem matches), and coverage in the React-free layer is near-total; the gap is specifically the UI layer, which is exercised only indirectly through `src/app/routing.test.tsx` and `src/test/smoke.test.tsx`. **Write a characterization test for a file before splitting it.** That is row 1 of the recommended actions table, and every split row below depends on it.

**2. Git churn is not usable as evidence in this repository, and no severity here rests on it.** The entire 23-commit history spans two calendar days of one scripted rewrite off the `670b5fe` Google AI Studio baseline. Commit frequency therefore carries no signal about which files are hot or cold and no signal about maintenance pressure. Where a Phase 3 verifier cited specific commits as proof that a file is not a cold path, **that reasoning is withdrawn**; the severities in this report stand on file size, responsibility mixing, and what an extraction actually removes. Any future re-run of this audit should treat churn as unavailable until the repo has a real history.

**3. The migration environment is unusually safe — which is why the recommended splits are low-risk despite caveat 1.** Repo-wide there are zero dynamic `import()` calls, zero `React.lazy`, zero `require` / `require.resolve`, zero `vi.mock` / `jest.mock`, no `__mocks__` directory, no package.json entry points beyond the build, and **zero path aliases**. The 86-module internal import graph is fully acyclic (244 code-to-code edges, 0 cycles), and all three split candidates have a static fan-out of exactly **1** import site each. The one real cost of having zero path aliases is that every intra-repo import is a relative specifier, so any file *move* rewrites the specifier in every importer and — if the directory depth changes — inside the moved file itself. The recommended splits avoid this entirely by adding siblings rather than moving anything.

## Counts

| Severity | Count |
| -------- | ----- |
| critical | 0 |
| high | 0 |
| medium | 3 |
| low | 9 |

| Category | Count |
| -------- | ----- |
| oversized-multi-responsibility | 3 |
| oversized-bloated-single-responsibility | 0 |
| oversized-high-fan-out | 0 |
| oversized-circular-risk | 0 |
| oversized-dynamic-ref-risk | 0 |
| oversized-monolithic-by-design | 1 |
| barrel-file-decay | 0 |
| directory-flat-too-many-files | 0 |
| co-location-scattered | 1 |
| import-graph-tangle | 0 |
| bug-found-while-testing | 3 |
| other | 4 |

| Phase | Count |
| ----- | ----- |
| Discovery (lot-by-lot) | 7 |
| Red team (cross-cutting) | 5 |

## File size distribution

Bucket convention: lower bound inclusive, upper exclusive (0-100 = 0..99). The in-scope column is the operative one — it excludes test files, config, generated output and styles per the spec's scope rules. The Phase 0 inventory and the Phase 4 independent re-count agree exactly (`phase0InventoryAgreement: "exact"`, zero discrepancies, zero untracked source files missed).

| Range | In-scope files | All files |
| ----- | -------------- | --------- |
| 0-100 lines | 41 | 62 |
| 100-200 | 13 | 21 |
| 200-300 | 7 | 7 |
| 300-500 | 2 | 2 |
| 500-1000 | 1 | 1 |
| 1000-2000 | 0 | 0 |
| 2000+ | 0 | 1 |
| **Total** | **64** | **94** |

Thresholds over the in-scope set: **3 files >300 lines**, **1 file >500**, **0 >1000**, **0 >2000**. Largest file overall: `src/components/BookDetail.tsx` at 539 lines. The single all-files 2000+ entry is `package-lock.json` (4,884 lines, generated, out of scope).

### Top 15 files by size

| File | Lines | In scope |
| ---- | ----- | -------- |
| `package-lock.json` | 4884 | no |
| `src/components/BookDetail.tsx` | 539 | yes |
| `src/components/EReader.tsx` | 477 | yes |
| `src/components/ProfileView.tsx` | 439 | yes |
| `src/components/AddBookModal.tsx` | 285 | yes |
| `src/components/AudioPlayer.tsx` | 264 | yes |
| `src/components/QuizModal.tsx` | 254 | yes |
| `src/components/StatsView.tsx` | 238 | yes |
| `src/features/library/LibraryPage.tsx` | 230 | yes |
| `src/app/AppShell.tsx` | 222 | yes |
| `src/features/library/useLibrary.tsx` | 202 | yes |
| `src/components/ChatModal.tsx` | 182 | yes |
| `src/features/library/RecommendationCarousel.tsx` | 170 | yes |
| `src/features/review/reviewQueue.test.tsx` | 159 | no |
| `src/lib/storage/migrate.test.ts` | 153 | no |

_Re-running this inventory and diffing the two tables answers "which files have grown over the threshold since the last audit?" without re-reading a line of source._

## Critical

None. No finding in this audit reached critical severity.

## High

None. No finding in this audit reached high severity.

## Medium

### F001 · The book detail screen also carries a general-purpose markdown renderer that has nothing to do with books

**Medium · Oversized Multi-Responsibility · `src/components/BookDetail.tsx:33` · 539 lines · fan-out 1 (low) · discovery · confirmed**

- **What's wrong:** The repo's largest file is one screen that also contains a self-contained markdown-to-JSX renderer and a personal-notes editor. Neither of those reads anything from the screen around it, so they share a filename for no reason other than history.
- **Why it matters:** Anyone changing the screen scrolls past render logic that cannot possibly affect it, and the render logic itself cannot be tested without mounting the whole screen — which today has no test at all.
- **What to do:** Move the markdown renderer into its own file first, then confirm the app still typechecks, lints and passes. Treat the notes editor as an optional second step. Leave the sidebar alone — extracting it would need roughly fifteen props and would make the code worse.
- **Confidence:** High — confirmed; the verifier re-measured the line count and the import count independently and re-derived the case against extracting the sidebar.
- **Technical detail:** `src/components/BookDetail.tsx:33-115` (`formatInline` + `SummaryRenderer`) is a pure `(text: string) => JSX` unit whose only edge into the rest of the file is one call site at line 461 — move it verbatim to `src/components/SummaryRenderer.tsx`, add `export`, import it back; no signature change and no importer change.

**Current responsibilities mixed in this file**

- **Markdown-to-JSX rendering (pure; headers, bullet lists, paragraphs, bold/italic)** — ~83 lines (formatInline (module-local), SummaryRenderer (module-local))
- **Book detail screen — sidebar controls, AI actions (TTS + deep dive), PDF open, rating/priority/status mutations, summary sections, chat/quiz modal hosting** — ~391 lines (BookDetailProps (module-local interface), BookDetail (exported))
- **Personal-notes editor — local draft state, blur-to-save, textarea section** — ~32 lines (notes/setNotes useState (L148), sync useEffect (L150-153), handleSaveNotes (L219-223), notes &lt;section> (L502-520))

**Proposed split**

| New file | Responsibility | Approx. lines | Exports moved |
| -------- | -------------- | ------------- | ------------- |
| `src/components/SummaryRenderer.tsx` | Pure markdown-to-JSX renderer for summary text. Imports only `react`. Exports `SummaryRenderer`; keeps `formatInline` module-local. | 90 | formatInline; SummaryRenderer |
| `src/components/BookNotesEditor.tsx` | Self-contained notes textarea owning its own draft state and blur-to-save. Props: `{ value: string; onSave: (notes: string) => void }`. Imports `react` and `PenTool` from lucide-react. | 45 | notes useState; notes-sync useEffect; handleSaveNotes; notes &lt;section> JSX incl. its PenTool heading |
| `src/components/BookDetail.tsx (remains)` | Book detail screen only. Drops the `PenTool` import once the notes section moves. | 430 | BookDetail (unchanged export); BookDetailProps (unchanged) |

**Migration considerations**

- Static import sites: 1 — `src/features/book/BookDetailPage.tsx:3`. It imports `BookDetail`, whose path and export name are unchanged by the split, so no importer is rewritten.
- Dynamic / string-based references: 0 — repo-wide sweep found zero dynamic `import()`, zero `React.lazy`, zero `require` / `require.resolve`, zero `vi.mock` / `jest.mock`, no `__mocks__` directory and zero path aliases (no `compilerOptions.paths`, no `resolve.alias`).
- Barrel re-exports affected: None. The repo has exactly one barrel (`src/lib/covers/index.ts`) and it is not on this path. Do **not** create a new one — the extracted files land as flat siblings and should be imported directly by path.
- Test mock paths affected: None — `src/components/` contains no test files at all. That is also why this split has no automated safety net; see recommended action 1.
- Risk: low
- Behaviour delta to keep deliberate: the current save guard at `:220` is `if (notes !== book.personalNotes)`, comparing against the raw possibly-`undefined` field, while `:148` normalises with `|| ''`. Pass `value={book.personalNotes || ''}` and decide the guard semantics on purpose rather than by accident.
- The new `SummaryRenderer.tsx` will carry its own copy of `formatInline`. That is correct — do not DRY it against EReader’s near-namesake; see Shared module opportunities.

**Verifier note**

_Editorial note: the quote below is reproduced unaltered, including its passing use of commit counts under "SEVERITY". That churn reasoning is **withdrawn** — see limitation 2 in the executive summary. The `medium` severity stands on line count and responsibility mixing alone, which is what the spec’s medium row actually requires._

> LINE COUNT: my own `wc -l src/components/BookDetail.tsx` returns 539 — matches the finding exactly and clears the spec's 500-line high-confidence bar. GROUPINGS LOCATED IN SOURCE: Group A is lines 33-115 (comment L33; `formatInline` L34-53; `SummaryRenderer` L56-115) = 83 lines, exactly as claimed. Group B is lines 117-539 (`BookDetailProps` L117-129; `BookDetail` L131-539) = 423 lines. I traced every reference and the single edge between the two groups is real: `SummaryRenderer` is invoked once, at L461 (`<SummaryRenderer text={summary?.summary ?? 'No summary yet.'} />`), and `formatInline` is called only from inside `SummaryRenderer` (L79, L85, L99, L109). Group A reads nothing from the component scope — it is a pure function of its `text` prop. NOTES CLUSTER: verified independently. `notes`/`setNotes` appear at L148 (useState), L152 (sync effect body, effect spans L151-153 under the comment at L150), L510 (`value={notes}`), L511 (`setNotes(e.target.value)`); `handleSaveNotes` is declared L219-223 and used once at L512 (`onBlur`); the section JSX is L502-520 (comment L502, `<section>` L503-520, `PenTool` at L505). No other reference to `notes`, `setNotes` or `handleSaveNotes` exists in the file, so the discoverer's `sharedStateConcern: none` holds — I checked rather than assumed. FAN-OUT (my own count): 1 static import site. `grep -rn "BookDetail" src/` returns only `src/features/book/BookDetailPage.tsx:3` (`import { BookDetail } from '../../components/BookDetail'`) plus its own JSX use at L40; `src/app/routes.tsx:6` imports `BookDetailPage`, not this file. Discoverer said 1 — dead on. Repo-wide I confirmed zero `import(...)`, zero `React.lazy`, zero `vi.mock`/`jest.mock`, no `__mocks__`, and no tsconfig/vite path aliases, so there is no non-static reference path. `src/components/` also has no co-located test files at all, so no mock paths break. CIRCULAR-IMPORT CHECK: none possible. `SummaryRenderer.tsx` needs only `react`; `BookNotesEditor.tsx` needs only `react` + `PenTool` from `lucide-react`. Neither needs any symbol from `BookDetail.tsx` — `SummaryRenderer`'s props are the inline `{ text: string }` at L56, `BookNotesEditor`'s are two primitives — so no type travels back up and every edge points downward. ADVERSARIAL CHECKS: (1) The discoverer's warning against extracting the sidebar (L237-435) is correct and I re-derived it: that block reads `book` (L241-242, 268, 278, 282, 287, 293, 304, 323, 330, 356, 402, 417, 426), `isPreview` (L245, 253, 337, 424), `onAdd` (L253, 256), `onDelete` (L426), `updateRating` (L277), `updatePriority` (L302), `toggleStatus` (L358, 366), `setShowChat` (L340), `setShowQuiz` (L347), `isGeneratingAudio` + `handlePlayAudio` (L377-386), `isGeneratingDeepDive` + `handleMasterclassClick` (L390-399), `handleOpenPdf` (L404) and `summary` (L417 via `bookToMarkdown`) — ~15 distinct parent bindings. Extracting it would be a net loss; leaving it is the right call and is why medium, not high, is correct. (2) RESIDUAL: after both extractions the parent lands at ~430 lines — still above the 300-line floor, so BookDetail.tsx would remain a (lower-confidence) decomposition candidate afterwards. The discoverer states this openly (`approxLines: 430`) and rates `worthDoing: probably` rather than `yes`, which I consider honest calibration, not a defect. (3) SEVERITY: 539 lines with fan-out 1 matches the spec's medium row verbatim ('oversized-multi-responsibility files 300-800 lines with low fan-out'). `high` would require >800 lines or a demonstrably hot path; git shows 7 commits touching this file across a 23-commit history, so 'frequently changed' is not established. Medium stands. MIGRATION CAVEAT worth carrying into the fix work (not enough to amend): the current save guard is `if (notes !== book.personalNotes)` (L220) comparing against the raw, possibly-`undefined` field, while L148 normalises with `|| ''`. If `BookNotesEditor` compares `notes !== value` where `value` is already normalised, the edge case `book.personalNotes === undefined` + empty textarea stops firing `onUpdate`. That is arguably an improvement, but it is a behaviour delta — the extraction should pass `value={book.personalNotes || ''}` and keep the guard semantics deliberate.

### F002 · The profile screen also owns the app's entire library backup, restore and reset surface

**Medium · Oversized Multi-Responsibility · `src/components/ProfileView.tsx:28` · 439 lines · fan-out 1 (low) · discovery · confirmed**

- **What's wrong:** ProfileView edits a person's name, bio, voice and monthly goal, and it also holds the whole export / import / reset flow for the library. Four of its six inputs exist only for the second job, and the two halves share no state whatsoever.
- **Why it matters:** The backup-and-restore block holds the only real branching logic on the screen — file reading, JSON parsing, a shape check, a confirmation gate, a merge and three distinct error paths — and none of it can be tested while it sits inside a 439-line component.
- **What to do:** Extract the Data Management block into its own file, and stop there. A second extraction was proposed to carry the remainder under 300 lines; do not do it. Leaving the parent at roughly 306 lines is the right outcome — splitting further to hit a line-count number is not a maintenance benefit.
- **Confidence:** High — confirmed; every state reference was traced to its uses and every proposed leaf module was checked for a back-edge.
- **Technical detail:** Move `src/components/ProfileView.tsx:47-49`, `86-145` and the `<section>` at `295-358` into `src/components/ProfileDataManagement.tsx` behind two props (`buildExport`, `onImportLibrary`) the parent already receives and forwards; `ProfileViewProps` stays byte-identical, so the single import site at `src/features/profile/ProfilePage.tsx:2` never changes.

**Current responsibilities mixed in this file**

- **Profile identity + preference editing (header, avatar/initials, monthly-goal ring and slider, bio textarea, AI voice picker)** — ~168 lines (VOICES (module-local const, line 10), ProfileViewProps (line 28), ProfileView (line 37), isEditing / setIsEditing (45), editedProfile / setEditedProfile (46), handleSave (72), getInitials (77), header JSX (149-187), monthly goal card JSX (191-248), bio + voice picker JSX (250-293))
- **Library backup / restore / import (JSON export, Markdown export, backup file parse + validate + confirm + merge)** — ~125 lines (fileInputRef (47), importStatus / setImportStatus (48), confirm = useConfirm() (49), handleExportMarkdown (86), handleExport (96), handleImport (109), Data Management section JSX (295-358))
- **App settings + danger zone (theme toggle, decorative Privacy Mode switch, library reset button)** — ~49 lines (Settings section JSX (360-408), consumes only the onResetLibrary prop)
- **Derived reading stats (finishedCount, progressPercent, joinedDate, topGenres) + Knowledge Topography panel** — ~47 lines (stats useMemo (51-70), Knowledge Topography JSX (410-436))

**Proposed split**

| New file | Responsibility | Approx. lines | Exports moved |
| -------- | -------------- | ------------- | ------------- |
| `src/components/ProfileDataManagement.tsx` | Owns the library backup/restore surface end to end: JSON export, Markdown export, backup-file read + shape validation + confirm + merge, and the import status chip. Props { buildExport, onImportLibrary }. | 145 | fileInputRef; importStatus / setImportStatus; confirm (useConfirm); handleExportMarkdown; handleExport; handleImport; Data Management &lt;section> (295-358); imports: toast, useConfirm, libraryToMarkdown, downloadText, LibraryExport type, icons Download/FileText/Upload/FileJson/Check |
| `src/components/ProfileSettings.tsx` | Owns the Settings block: appearance card wrapping &lt;ThemeToggle/>, the Privacy Mode display switch, and the Danger Zone reset button. Props { onResetLibrary }. Stateless. | 60 | Settings &lt;section> (360-408); imports: ThemeToggle, icons Settings/ShieldAlert/Trash2 |
| `src/components/ProfileView.tsx` | RESIDUAL (not a new file) -- keeps profile identity, the isEditing/editedProfile cluster, preference editing, the stats useMemo and Knowledge Topography. Renders the two extracted sections as children, forwarding buildExport/onImportLibrary/onResetLibrary unchanged. | 260 | VOICES; ProfileViewProps (unchanged signature); ProfileView; handleSave; getInitials; stats useMemo |

**Migration considerations**

- Static import sites: 1 — `src/features/profile/ProfilePage.tsx:2`. `ProfileViewProps` stays byte-identical, so the import site needs no change at all.
- Dynamic / string-based references: 0 — repo-wide sweep found zero dynamic `import()`, zero `React.lazy`, zero `require` / `require.resolve`, zero `vi.mock` / `jest.mock`, no `__mocks__` directory and zero path aliases (no `compilerOptions.paths`, no `resolve.alias`).
- Barrel re-exports affected: None. The repo has exactly one barrel (`src/lib/covers/index.ts`) and it is not on this path. Do **not** create a new one — the extracted files land as flat siblings and should be imported directly by path.
- Test mock paths affected: None — `src/components/` contains no test files at all. That is also why this split has no automated safety net; see recommended action 1.
- Risk: low
- Every proposed leaf was traced for a back-edge: `ui/ConfirmDialog.tsx` imports only `react` + `./Dialog`, `lib/markdown.ts` only `../types`, `lib/download.ts` nothing, `ui/toastStore.ts` nothing. No cycle is constructible.
- Step 2 (`ProfileSettings.tsx`) is **not recommended** — see the dispute note above. Step 3 (replacing `handleExport`’s hand-rolled Blob/`createObjectURL`/anchor dance at `:98-106` with the existing `downloadText` helper, which already takes the MIME type as its third parameter) is a good DRY fix but belongs in a separate commit.

**Disputed second step — recommend step 1 only**

The finding proposes two extractions. Phase 3 called the second one (`ProfileSettings`) "load-bearing" because extraction 1 alone leaves the parent at roughly 306 lines. The red team’s counter, adopted here: that file would exist only to carry the residual under an arbitrary 300-line target — no state, no logic, one prop, three static cards — which is exactly the over-splitting the spec forbids ("don’t recommend splits because the file is too long"). One of those three cards is the dead Privacy Mode switch in RT-F001; giving inaccurate UI its own module makes it *less* likely to be noticed and deleted.

**Do extraction 1 only.** Leaving `src/components/ProfileView.tsx` at ~306 lines — marginally over the floor — is the honest outcome to report, not a problem to engineer around. The severity still stands at `medium`, but on the ground that extraction 1 removes the file’s only real branching logic and its only untested error paths, not on the cold-path/churn reasoning the Phase 3 verifier used.

**Verifier note**

_Editorial note: the quote below is reproduced unaltered, including adversarial check (2), where the verifier justifies `medium` by reading two named commits as proof this is "not a cold path". **That reasoning is withdrawn** — see limitation 2 in the executive summary. `medium` still stands, on the ground stated above: extraction 1 removes the file’s only real branching logic and its only untested error paths. Adversarial check (1)’s arithmetic — that extraction 1 alone leaves ~306 lines — is accepted; the conclusion drawn from it, that a second extraction is therefore "load-bearing", is not._

> LINE COUNT: my own `wc -l src/components/ProfileView.tsx` returns 439 — matches exactly; over the 300-line floor, under the 500 high-confidence bar. TOP-LEVEL DECLARATIONS: confirmed as claimed — exactly three, `VOICES` (L10), `interface ProfileViewProps` (L28-35), `export const ProfileView` (L37-439). No module-local subcomponents, so the finding correctly rests its case on internal groupings rather than on export sprawl. PROPS EVIDENCE: verified at L28-35 — `profile` (L29) and `onUpdate` (L30) are profile concerns; `books` (L31), `onResetLibrary` (L32), `buildExport` (L33), `onImportLibrary` (L34) are library concerns. 4 of 6, as claimed. GROUPING B (backup/restore/import) located in source: `fileInputRef` L47, `importStatus` L48, `confirm = useConfirm()` L49, `handleExportMarkdown` L86-94, `handleExport` L96-107, `handleImport` L109-145, Data Management `<section>` L295-358. I traced every use of its state: `fileInputRef` at L144, L331, L335; `importStatus`/`setImportStatus` at L121, L134, L135, L139, L337, L339, L344; `confirm` at L125. Every one of those is inside the block being moved — nothing in the header, goal card, bio card, settings block or topography panel touches them. So no state is lifted and no setState is drilled: `sharedStateConcern: none` is accurate. The block's only outside needs are `buildExport` (L87, L97) and `onImportLibrary` (L132), both already props on the parent — pure pass-through, one level. GROUPING C (Settings) located at L360-408: stateless, reads only `onResetLibrary` (L401) and renders `<ThemeToggle />` (L371). Confirmed. DRY CLAIM VERIFIED: `src/lib/download.ts:2` is `export function downloadText(filename, contents, mimeType = 'text/markdown')` whose body (L3-11) is Blob -> createObjectURL -> createElement('a') -> append -> click -> remove -> revokeObjectURL. `handleExport` at L98-106 is that same body inlined, differing only in passing `application/json` — which the third parameter already accepts. The discoverer's characterisation is correct. FAN-OUT (my own count): 1 static import site — `grep -rn "ProfileView" src/` returns only `src/features/profile/ProfilePage.tsx:2` (import) and its JSX use at L31. Discoverer said 1. Repo-wide: zero dynamic imports, zero `React.lazy`, zero `vi.mock`/`jest.mock`, no `__mocks__`, no path aliases, no test files in `src/components/`. CIRCULAR-IMPORT CHECK: I traced every proposed leaf edge rather than trusting the claim. `src/components/ui/ConfirmDialog.tsx` imports only `react` (L1-2) and `./Dialog` (L3). `src/lib/markdown.ts` imports only `../types` (L1). `src/lib/download.ts` imports nothing. `src/components/ui/toastStore.ts` imports nothing. `src/features/settings/ThemeToggle.tsx` imports only `lucide-react` (L1) and `./useTheme` (L2-3). None of them reach back into `src/components/`, so no cycle is constructible. The one components->features edge (`ProfileSettings.tsx` -> `features/settings/ThemeToggle`) already exists today at ProfileView.tsx:5, so the split relocates it rather than creating it; the only other features->components edge in that subtree is `ApiKeyDialog.tsx:7 -> components/ui/Dialog`, which is not on any proposed path. ADVERSARIAL CHECKS: (1) RESIDUAL — I did the arithmetic myself rather than accepting '~260'. Removing grouping B (3 state lines + 60 handler lines + 64 section lines + ~9 now-dead import lines, minus ~5 added for the child import and its JSX) puts the parent at ~306 — i.e. the Data Management extraction ALONE leaves the file still marginally over the 300-line floor. Adding the Settings extraction (~50 JSX lines + 4 import lines, minus ~3) brings it to ~255-265, matching the claim. This matters for the fix work: the second extraction is load-bearing for clearing the threshold, not an optional extra, and the report should say so. (2) SEVERITY — the discoverer flagged medium-vs-low as genuinely ambiguous and invited a `low` amendment on cold-path grounds. Git evidence resolves it in favour of medium and against the amendment: `git log -- src/components/ProfileView.tsx` shows 7 commits, and two are real feature commits, not infrastructure sweeps — `ae72077 feat(export): export a book or the whole library as Markdown` and `68e20c0 feat(theme): add dark mode`. Notably `ae72077` is what landed the very Data Management section proposed for extraction. This is not a cold path, so the spec's low row ('300-500 lines on cold paths (rarely modified)') does not apply and the medium row ('300-800 lines with low fan-out') does. Severity confirmed as filed. (3) OVER-SPLIT TEST — the discoverer's refusal to extract the Monthly Goal card (L191-248) or the Bio/Voices card (L250-293) is correct and I re-derived it: `isEditing`/`editedProfile`/`setEditedProfile` are read by the header Edit/Save button (L170, L172, L177, L183), the goal card (L228, L237, L239, L244) and the bio/voices card (L257, L260-261, L279, L281) — three siblings sharing one useState pair in one scope. Extracting either would drill a setState across siblings. Likewise the `stats` useMemo (L51-70) genuinely must stay: `stats.joinedDate` feeds the header (L160), `stats.finishedCount`/`stats.progressPercent` feed the goal card (L209, L216), `stats.topGenres` feeds the topography panel (L416-417). Stopping at two extractions is the right boundary.

### RT-F001 · A permanently-on "Privacy Mode" switch claims local storage encryption the app does not have

**Medium · Bug Found While Testing · `src/components/ProfileView.tsx:385` · 439 lines · fan-out 1 (low) · red team · confirmed**

- **What's wrong:** The profile settings block renders a switch labelled "Privacy Mode / Local storage encryption" pinned in the on position. It is a styled box with no handler, no state and no keyboard access, and nothing anywhere in the app encrypts anything.
- **Why it matters:** It tells a user their notes, books and summaries are encrypted at rest when they are stored in plain IndexedDB. That is a false security claim on a project heading for a public open-source release, and the control is also unreachable by keyboard.
- **What to do:** Delete the card or wire it to a real setting. Decide before any settings extraction carries it forward — giving dead, inaccurate UI its own module makes it less likely to be noticed and removed.
- **Confidence:** High — two independent red-team classes found it separately, and a repo-wide search for any encryption primitive returned only the label string itself.
- **Technical detail:** `src/components/ProfileView.tsx:385-387` is a `<div>` styled `bg-orange-600 rounded-full` with the knob pushed right, carrying no `onClick`, `onChange`, `role`, `tabIndex` or `aria-checked`; `grep -rni 'encrypt|crypto.subtle|cipher' src/` matches only the label on line 382.

Filed `low` by the red team for consistency with this audit's other incidental bug, and because this spec's severity scale is written entirely around decomposition cost and has no row describing a user-facing false claim. It is carried here at `medium` because the defect is a security assertion the product does not implement. Note that no part of that calibration rests on git history — see the limitations in the executive summary.

**Verifier note**

> Phase 4 red-team finding — filed directly by the cross-cutting sweep and not routed through Phase 3 verification. Its evidence was gathered first-hand by the class subagent against the source at the audited commit.

## Low

### F004 · The reader screen contains a themed markdown renderer that is already fully prop-driven

**Low · Oversized Multi-Responsibility · `src/components/EReader.tsx:27` · 477 lines · fan-out 1 (low) · discovery · confirmed**

> **Contested and superseded.** RT-F005 below reaches the opposite conclusion about this same file, and this report sides with RT-F005. F004 is not factually wrong about anything it asserts — the verifier checked every claim — but it omits the split’s principal cost. The recommendation is **not adopted**; see the adjudication under RT-F005 and row 11 of the recommended actions table.

- **What's wrong:** EReader is a reader shell — pagination, chrome, theming, audio — plus a 135-line themed markdown renderer. The renderer already receives everything it needs as props and touches none of the reader’s state, so the boundary is drawn in the source today.
- **Why it matters:** The renderer holds seven distinct rendering branches that cannot be exercised today without mounting a full-screen reader carrying five pieces of state, a memo, a scroll effect and a text-to-speech path.
- **What to do:** Nothing, for now. This finding is contested and this report recommends against acting on it — see RT-F005 below. If it is ever executed, the `Theme` type must move into the new file rather than stay behind.
- **Confidence:** High for the facts, low for the recommendation — every claim was verified line by line, but the red team’s counter-case supersedes the conclusion.
- **Technical detail:** `src/components/EReader.tsx:27` plus `30-163` would move to `src/components/ReaderContent.tsx` with `Theme` exported from there; leaving `Theme` at line 27 creates an `EReader -> ReaderContent -> EReader` cycle, and because `tsconfig.json` sets `verbatimModuleSyntax: true` a missing `type` keyword would make that a genuine runtime cycle — with no `import/no-cycle` rule in the toolchain to catch it.

**Current responsibilities mixed in this file**

- **Themed markdown-to-JSX rendering (headers, blockquotes, bullet + numbered lists, drop caps, inline emphasis); derives its own accent/heading/dropcap colours from the `theme` prop** — ~135 lines (Theme (module-local type), formatInline (module-local), RenderFormattedContent (module-local))
- **Reader shell — pagination over `##`-split sections, scroll reset, header/settings-popover/footer chrome, progress bar, reader theme + font-size state, long-form audio generation** — ~322 lines (EReaderProps (module-local interface), FontSize (module-local type), EReader (exported))

**Proposed split**

| New file | Responsibility | Approx. lines | Exports moved |
| -------- | -------------- | ------------- | ------------- |
| `src/components/ReaderContent.tsx` | Themed markdown-to-JSX renderer for reader content. Exports `RenderFormattedContent` and the `Theme` type (the type must live here, not in EReader — see circularImportRisk). Keeps `formatInline` module-local. Imports only `react`. | 140 | Theme; formatInline; RenderFormattedContent |
| `src/components/EReader.tsx (remains)` | Reader shell only — pagination, chrome, reader theming state, audio. Gains `import { RenderFormattedContent, type Theme } from './ReaderContent';` | 344 | EReader (unchanged export); EReaderProps (unchanged); FontSize (stays — used only by the shell at L175) |

**Migration considerations**

- Static import sites: 1 — `src/features/book/ReaderPage.tsx:3`. Export name and path are unchanged by the split.
- Dynamic / string-based references: 0 — repo-wide sweep found zero dynamic `import()`, zero `React.lazy`, zero `require` / `require.resolve`, zero `vi.mock` / `jest.mock`, no `__mocks__` directory and zero path aliases (no `compilerOptions.paths`, no `resolve.alias`).
- Barrel re-exports affected: None. The repo has exactly one barrel (`src/lib/covers/index.ts`) and it is not on this path. Do **not** create a new one — the extracted files land as flat siblings and should be imported directly by path.
- Test mock paths affected: None — `src/components/` contains no test files at all. That is also why this split has no automated safety net; see recommended action 1.
- Risk: medium — low in the import graph, but the `Theme` hazard and the two-file theme palette are both real; see RT-F005.
- `Theme` must move **into** `ReaderContent.tsx` and be re-imported by `EReader.tsx`. Getting the direction wrong creates an `EReader -> ReaderContent -> EReader` cycle; `verbatimModuleSyntax: true` means a missing `type` keyword turns that type-only cycle into a genuine runtime cycle, and the repo has no `import/no-cycle` rule and no `eslint-plugin-import` dependency, so nothing in `typecheck`, `lint`, `format:check` or `test` would catch it. It would land silently.
- Documentation pinned by path: `CLAUDE.md:60` names this exact file as the deliberate exclusion from the app-wide theme, and `docs/superpowers/plans/2026-08-12-booksum-refactor-handover.md:18-26` names all three candidates with line counts. Nothing machine-reads either, so a split would leave stale project instructions that future sessions load into context.

**Verifier note**

_Editorial note: the quote below is reproduced unaltered, including adversarial check (1), which validates the "cold path" claim from `git log`. **That reasoning is withdrawn** — see limitation 2 in the executive summary. `low` still stands, on the marginal value of the split rather than on how often the file has been touched. Everything the note establishes about the groupings, the `Theme` cycle direction and the reader-theme invariant is unaffected, and is the strongest evidence in this finding._

> LINE COUNT: my own `wc -l src/components/EReader.tsx` returns 477 — matches exactly; over the 300-line floor, under the 500 high-confidence bar, as the finding itself states. GROUPINGS LOCATED IN SOURCE: Group A is `type Theme` at L27 plus L30-163 (doc comment L30-32; `formatInline` L33-51; `RenderFormattedContent` L53-163) = 135 lines, exactly the claimed figure. Group B is `EReaderProps` L18-25, `type FontSize` L28, and `EReader` L165-477 = 322 lines. Single edge confirmed: `RenderFormattedContent` is rendered once, at L394-398, with `content={pages[currentPage]}` / `isFirstPage={currentPage === 0}` / `theme={theme}`; `formatInline` is called only from inside the renderer (L110, L123, L134, L150, L157). PROP-DRILLING TEST — this is the strongest part of the finding and it holds: I read L53-163 line by line and `RenderFormattedContent` reads only its three props plus module-local `formatInline`. It touches no `EReader` state, no ref, no handler. The boundary is already drawn today, so extraction drills nothing new. TYPE-CYCLE ANALYSIS VERIFIED, INCLUDING DIRECTION: `Theme` is consumed by the shell at L174 (`useState<Theme>('light')`) and L319 (`(['light','sepia','dark'] as Theme[])`), and by the renderer at L53 (props) and L59/L60/L61/L87/L95/L108/L121. The discoverer's warning is exactly right — leaving `Theme` declared in `EReader.tsx` would force `ReaderContent.tsx` to import from `EReader.tsx` while `EReader.tsx` imports `ReaderContent.tsx`, a real (if type-erased) cycle. Moving `Theme` into `ReaderContent.tsx` and re-importing it makes every edge point shell-to-leaf. Confirmed correct as specified, and it is a genuine trap the proposal catches rather than creates. Minor stylistic note, not a defect: having the shell that OWNS the theme state import the `Theme` type from the content renderer is slightly inverted; a third `readerTheme.ts` holding only the union would read better but is a new file for one type line, which the spec's over-splitting principle argues against. The proposal's choice is the right trade. THEME INVARIANT (CLAUDE.md: EReader is deliberately excluded from the global `.dark` class) — I checked this specifically because the task flagged it. `grep -c "dark:" src/components/EReader.tsx` returns 2, and both are false positives: L226 (`dark: 'bg-[#1a1a1a] ...'`) and L242 (`dark: {`) are OBJECT PROPERTY KEYS in `themeStyles` and `uiColors`, not Tailwind `dark:` utilities. The file uses zero global dark-mode classes. Everything constituting reader theming stays in the shell under the proposal and I confirmed each cited anchor: `theme` useState L174, `themeStyles` L223-227, `uiColors` L229-248, `activeUI` L250, theme-selector UI L311-340. The only colour logic that moves is what already lives inside the renderer and is already derived from its `theme` prop — `accentColor`/`headingColor`/`dropCapColor` at L59-61 plus the inline `theme === 'dark' ? ...` ternaries at L87, L95, L108, L121. The split introduces no `.dark:` utility and does not drag reader theming into the global system. The invariant is respected. FAN-OUT (my own count): 1 static import site — `grep -rn "EReader" src/` returns only `src/features/book/ReaderPage.tsx:3` (import) and its JSX use at L23. Discoverer said 1. Repo-wide: zero dynamic `import(...)`, zero `React.lazy`, zero `vi.mock`/`jest.mock`, no `__mocks__`, no tsconfig/vite path aliases, no test files in `src/components/`. ADVERSARIAL CHECKS: (1) COLD-PATH CLAIM VERIFIED — `git log --oneline -- src/components/EReader.tsx` returns exactly 5 commits and every one is a sweeping infrastructure change: `0e03747` toolchain migration, `6a09d75` storage schema, `cfe849b` BYOK/profiles, `9646136` ESLint+Prettier+CI, `a48337f` the a11y pass. No feature commit has ever targeted this file, which is the evidence the spec's low row wants ('rarely modified'). `low` is correctly calibrated and I would not raise it. (2) RESIDUAL — 477 minus 135 plus one import line leaves ~344, so `EReader.tsx` stays above the 300-line floor after the split and would still surface in a future run of this audit. The discoverer states this figure openly and rates `worthDoing: probably`. The benefit that survives is real and verifiable: 135 lines of pure, prop-driven render logic currently cannot be exercised without mounting the full reader (five useStates, a useMemo, a scroll effect and a TTS call path), and there is no co-located test anywhere in `src/components/`. Confirmed as filed — but the report's recommendation row should carry the residual-344 caveat so the reader is not sold a 'file no longer oversized' outcome.

### RT-F005 · The reader owns its own theme system, and the proposed split would cut that system in half

**Low · Oversized Monolithic By Design · `src/components/EReader.tsx:27` · 477 lines · fan-out 1 (low) · red team · confirmed**

- **What's wrong:** The reader's three-theme palette lives in exactly one file today. The split proposed by F004 leaves five theme mappings behind and moves seven, with nothing in the type system keeping the two halves coherent — the `Theme` union guarantees the keys match, not that the colours do.
- **Why it matters:** CLAUDE.md names this exact file as deliberately owning its own reader themes. After the split that sentence is half-true, adding or restyling a reader theme becomes a synchronised two-file edit with no compiler backstop, the extracted module has one consumer for the life of the project, and the parent is still 344 lines — over the threshold that flagged it in the first place.
- **What to do:** Leave `src/components/EReader.tsx` whole. Fix the animation bug inside it (RT-F004) instead — that is the concrete defect the file is actually carrying.
- **Confidence:** Medium — the underlying facts are certain and independently corroborated; the call between splitting and not splitting is genuinely close, and this report resolves the tie toward not splitting per the spec’s governing principle.
- **Technical detail:** 7 of 13 theme mappings cross the proposed boundary — `accentColor` / `headingColor` / `dropCapColor` at `:59-61` plus ternaries at `:87`, `:95`, `:108`, `:121` move, while `themeStyles` `:223-227`, `uiColors` `:229-248`, `:281-287`, `:318-339` and `:452-458` stay — and the shell that owns `useState<Theme>` at `:174` would have to import its own state’s type from its child.

**Adjudication — this report sides with RT-F005 and recommends against executing F004.**

Both findings are live and both are accurate; they are not duplicates (different categories, opposite conclusions), so both are rendered. They cannot both be acted on, so the report adjudicates rather than presenting them as two independent facts.

The red team’s case: the split cuts the reader’s own three-theme palette across two files (7 of 13 theme mappings move) against a CLAUDE.md invariant that names this file specifically, with no compiler backstop keeping the two halves coherent; it forces the shell that owns the theme state to import its own `useState<Theme>` type from its child; and it leaves a still-oversized ~344-line residual plus a module that will have exactly one consumer forever and cannot serve any other surface, because its `theme: Theme` prop welds it to this reader’s palette vocabulary. A separate red-team class (the multi-responsibility classifier) independently rated EReader the **weakest** of the three split candidates — "marginal" — on the ground that its extracted renderer takes reader-domain props (`theme`, `isFirstPage`), which makes it look like an inline subcomponent of one responsibility rather than a second responsibility.

What weighs the other way, stated openly: the testability gain is real (111 lines, seven pure branches, none reachable today without mounting the whole reader), and a live bug was found in this very file while reading it (RT-F004) — a concrete instance of "defects hide in long files", counted here as evidence *for* splitting.

The tiebreaker is the spec’s own governing principle: **over-splitting is worse than under-splitting**, and a near-tie resolves to not splitting. At 477 lines the file also sits under the 500-line high-confidence bar, which is where the burden of proof falls on the recommender. Note that neither side of this adjudication rests on F004’s cold-path argument, which was derived from git history and is not usable in this repository.

**Category caveat, stated plainly.** The `oversized-monolithic-by-design` row in the spec's enum reads "file >500 lines". EReader is 477. No in-scope file in this repo reaches 500 except `src/components/BookDetail.tsx` at 539, so the category is applied at this repository's real scale. The substance is unaffected.

**Current responsibilities mixed in this file**

_The same two groupings F004 identifies. This finding does not dispute that they exist; it disputes that separating them is worth the cost._

- **Themed markdown-to-JSX rendering (headers, blockquotes, bullet + numbered lists, drop caps, inline emphasis); derives its own accent/heading/dropcap colours from the `theme` prop** — ~135 lines (Theme (module-local type), formatInline (module-local), RenderFormattedContent (module-local))
- **Reader shell — pagination over `##`-split sections, scroll reset, header/settings-popover/footer chrome, progress bar, reader theme + font-size state, long-form audio generation** — ~322 lines (EReaderProps (module-local interface), FontSize (module-local type), EReader (exported))

**Proposed split**

| New file | Responsibility | Approx. lines | Exports moved |
| -------- | -------------- | ------------- | ------------- |
| _(none — no split recommended)_ | File stays whole | — | — |

**Migration considerations**

- Static import sites: 1 — `src/features/book/ReaderPage.tsx:3`. Unchanged, because no split is proposed.
- Dynamic / string-based references: 0 — repo-wide sweep found zero dynamic `import()`, zero `React.lazy`, zero `require` / `require.resolve`, zero `vi.mock` / `jest.mock`, no `__mocks__` directory and zero path aliases (no `compilerOptions.paths`, no `resolve.alias`).
- Barrel re-exports affected: None. The repo has exactly one barrel (`src/lib/covers/index.ts`) and it is not on this path. Do **not** create a new one — the extracted files land as flat siblings and should be imported directly by path.
- Test mock paths affected: None — `src/components/` contains no test files at all. That is also why this split has no automated safety net; see recommended action 1.
- Risk: low — leaving the file whole has no migration cost at all. The risk being avoided is the two-file theme palette described above.
- The reference sweep independently rated this file `safeToSplit: true` on import-graph grounds. This finding does not dispute that; it disputes whether the split is worth doing, which is a different question.

**Verifier note**

> Phase 4 red-team finding — filed directly by the cross-cutting sweep and not routed through Phase 3 verification. Its evidence was gathered first-hand by the class subagent against the source at the audited commit.

### RT-F004 · The reader’s page-turn animation has never replayed — `key` was typed inside the className string

**Low · Bug Found While Testing · `src/components/EReader.tsx:393` · 477 lines · fan-out 1 (low) · red team · confirmed**

- **What's wrong:** A JSX `key` prop was written inside the quoted `className` value instead of as an attribute, so React never remounts the wrapper and the entrance animation plays exactly once, on first mount of the reader.
- **Why it matters:** Every subsequent page turn swaps the content with no transition — the reader’s headline polish is silently dead after page one. Three junk tokens are also emitted as CSS class names on every render.
- **What to do:** Move `key={currentPage}` out of the string and onto the element as a real prop. One line.
- **Confidence:** High — the line was read directly and a repo-wide search confirms it is a one-off, not a pattern.
- **Technical detail:** `src/components/EReader.tsx:393` — `className="animate-in fade-in slide-in-from-bottom-4 duration-700 key={currentPage}"`. Invisible to every gate the project runs: TypeScript accepts any string as `className`, ESLint has no rule inspecting string contents, Prettier reformats it happily, and no test mounts the reader at all.

**Verifier note**

> Phase 4 red-team finding — filed directly by the cross-cutting sweep and not routed through Phase 3 verification. Its evidence was gathered first-hand by the class subagent against the source at the audited commit.

### RT-F003 · The one type binding the six-directory audio pipeline together is declared inside a UI component

**Low · Co-Location Scattered · `src/components/AudioPlayer.tsx:4` · 264 lines · fan-out 4 (low) · red team · confirmed**

- **What's wrong:** `AudioTrack` is a four-field, React-free data shape, but it is declared inside a presentational player component instead of `src/types.ts`, where all eleven other cross-layer shapes live.
- **Why it matters:** The shell's own public API surface has to reach sideways into a UI leaf for a type it needs in order to describe itself. A repo-wide sweep confirms this is the only place in the codebase where a shared type does not come from the designated shared layer.
- **What to do:** Optional. Moving the interface to `src/types.ts` follows a pattern the codebase already has, so it introduces nothing new — but nothing breaks if it stays. The other five directories the audio unit spans are mandated by the ESLint-enforced layering invariant and must not be touched.
- **Confidence:** High — every cross-top-level-directory type import in the repo was enumerated; this is a singleton, not a pattern.
- **Technical detail:** `src/components/AudioPlayer.tsx:4-9` declares `AudioTrack`; `src/app/ShellContext.ts:2` type-imports it for `ShellApi.playAudio` at `:5`, and `src/app/AppShell.tsx:5` does the same — `src/app/ShellContext.ts` otherwise imports nothing at all from the components tree.

**Verifier note**

> Phase 4 red-team finding — filed directly by the cross-cutting sweep and not routed through Phase 3 verification. Its evidence was gathered first-hand by the class subagent against the source at the audited commit.

### F003 · Two modals' close buttons have no name a screen reader can announce

**Low · Bug Found While Testing · `src/components/ChatModal.tsx:116` · 182 lines · fan-out 1 (low) · discovery · confirmed**

- **What's wrong:** The close buttons in the chat drawer and the quiz modal contain only an icon with no text and no label, so assistive technology announces them as just "button".
- **Why it matters:** These are the primary dismiss control for an `aria-modal` dialog. Two other modals in the same repo wired it correctly, so this is copy-paste drift rather than a deliberate choice — and it is exactly the drift the shared-modal-shell observation (F006) predicted.
- **What to do:** Add `aria-label="Close"` to both buttons, matching what the shared `Dialog` primitive already does. Two attributes, no structural change.
- **Confidence:** High — confirmed by reading all four files and grepping each of them for every possible source of an accessible name.
- **Technical detail:** `src/components/ChatModal.tsx:116-121` and `src/components/QuizModal.tsx:167-172` wrap a bare lucide `<X size={20} />`; `src/components/ui/Dialog.tsx:43` and `src/components/DailyWisdomModal.tsx:41` carry `aria-label="Close"` on the identical shape. Escape-to-close still works via `src/components/ui/useFocusTrap.ts:37-41`, so this is a degraded path rather than a trap — hence `low`.

**Verifier note**

> Verified by reading all four cited files, not the excerpt. DEFECT SITE 1 — `src/components/ChatModal.tsx` L116-121: `<button onClick={onClose} className="p-2 hover:bg-gray-100 ...">` whose only child is `<X size={20} />` (L120). I grepped the whole file for every accessible-name source: `aria-label` — zero occurrences; `title=` — zero occurrences; `sr-only` — zero occurrences; `aria-labelledby` appears once, at L98, and it is on the dialog panel (pointing at the `<h3 id={titleId}>` at L108), not on the button. The button therefore exposes no accessible name. DEFECT SITE 2 — `src/components/QuizModal.tsx` L167-172: identical shape, `<X size={20} />` at L171 as the sole child. Grep of the whole file returns only three a11y attributes: `role="dialog"` (L104), `aria-labelledby` (L106) and one `sr-only` (L109) — and I read L109 to be sure: it is `<h2 id={titleId} className="sr-only">`, the dialog's visually-hidden TITLE, not text inside the close button. The discoverer's claim that the file contains no `aria-label` anywhere is literally true. So there is no route by which either button gets a name — I looked for the routes the discoverer might have missed and found none. CONTRAST CASES CONFIRMED — `src/components/ui/Dialog.tsx` L41-47 carries `aria-label="Close"` on L43 above the same `<X size={20} />` (L46); `src/components/DailyWisdomModal.tsx` L39-45 carries `aria-label="Close"` on L41 above `<X size={20} />` (L44). Two call sites in this repo add the attribute to the identical button shape and two do not — that internal inconsistency is itself decisive evidence that the lucide `X` supplies no name (I could not inspect lucide-react directly because `node_modules` is not installed in this worktree, but lucide renders a bare `<svg>` of `<path>` children with no `<title>`, `role` or `aria-label`, and an svg with no text nodes contributes nothing to name-from-content). SEVERITY MITIGATION CONFIRMED — I read `src/components/ui/useFocusTrap.ts` L33-41 and Escape-to-close is real: `if (event.key === 'Escape') { event.stopPropagation(); onClose(); return; }`. All three modals call `useFocusTrap` (ChatModal L34, and Dialog L19), so this is a degraded path rather than a trap. `low` and `bug-found-while-testing` are both correct. LINE COUNT: `wc -l` gives ChatModal 182 (matches the filed `lines: 182`) and QuizModal 254; neither is a decomposition finding and neither is claimed to be. Fan-out recorded as 1 for the cited file (ChatModal is imported once, at `src/components/BookDetail.tsx:30`; QuizModal likewise at L31) — the filed value of 0 is a non-substantive artefact of this being an a11y finding rather than a split proposal, and does not affect the verdict. The fix is attribute-only: add `aria-label="Close"` at ChatModal.tsx:118 and QuizModal.tsx:169. No import-graph impact.

### F008 · One OpenLibrary cover-URL template is hardcoded in three modules, only one of which is the covers module

**Low · Other · `src/lib/goodreads.ts:121` · 123 lines · fan-out 4 (low) · discovery · amended**

- **What's wrong:** Knowledge of the OpenLibrary cover-CDN URL template is written out in the covers module, in the Goodreads parser, and six more times inside the seed recommendation data. A reader who finds `src/lib/covers/` and concludes it is the complete cover surface is wrong by two modules.
- **Why it matters:** If OpenLibrary changed its cover URL scheme, eight hardcoded instances across three source files plus two test assertions would need editing. The original framing called the two functions duplicates; they are not — they are two different endpoints of the same public API.
- **What to do:** Nothing. This is recorded so the placement is a known choice rather than an accident. If it is ever changed, the Goodreads import path must keep its zero-network URL builder — routing it through `fetchCover` would turn a large library import into two or three HTTP requests per book.
- **Confidence:** High (amended) — the locality observation is real and every cited line was verified, but the scatter is wider than first reported and "duplication" was the wrong word.
- **Technical detail:** `src/lib/covers/openLibrary.ts:8` builds the `/b/id/` form (async, resolves a `cover_i` from a second host first); `src/lib/goodreads.ts:122` builds the `/b/isbn/` form (pure, synchronous, zero-network); `src/features/library/recommendationDefaults.ts:12,18,24,30,37,43` embeds six pre-baked literals, and `src/lib/covers/index.test.ts:41` plus `src/lib/goodreads.test.ts:98` pin the template as a string.

**Verifier note**

> AMENDED - the underlying locality observation is real and I verified every cited line, but the finding UNDERCOUNTS the scatter (three source modules, not two) and OVERSTATES the relationship between the two functions (they are not duplicates). The category is also wrong. And the placement it implicitly argues for is a defensible-either-way taste call, which under the spec's `## Out of scope` ban on convention preference keeps it out of the numbered findings.
>
> LINE COUNTS I RE-MEASURED: src/lib/goodreads.ts = 123 (matches; well under the 300 floor, correctly not a split); src/lib/covers/openLibrary.ts = 9; src/lib/covers/index.ts = 22; src/lib/covers/googleBooks.ts = 29; src/lib/covers/placeholder.ts = 15; src/features/library/recommendationDefaults.ts = 45.
>
> FAN-OUT I RE-GREPPED: 6 import statements targeting lib/goodreads across 4 files - GoodreadsImport.tsx:3 and :4, useLibrary.tsx:5 and :6, goodreadsImport.test.tsx:7, goodreads.test.ts:2. Matches the finding exactly.
>
> EVERY CITED LINE VERIFIED: goodreads.ts:120-123 is the docstring plus `coverForIsbn`, building `https://covers.openlibrary.org/b/isbn/${isbn13}-L.jpg` at :122. covers/openLibrary.ts:8 builds `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`. useLibrary.tsx:5 and :7 import the two halves from the two modules and :158 rejoins them as `coverImageUrl: coverForIsbn(row.isbn13) ?? placeholderCover(row.title)`. All exact.
>
> AMENDMENT 1 - THE SCATTER IS WIDER THAN REPORTED. A repo-wide `grep -rn openlibrary src/` finds the cover-CDN URL template in THREE source modules, not two: covers/openLibrary.ts:8, goodreads.ts:122, and - missed by the finding - src/features/library/recommendationDefaults.ts at lines 12, 18, 24, 30, 37 and 43, six hardcoded `https://covers.openlibrary.org/b/isbn/<isbn>-L.jpg` literals in the seed recommendation data. It is additionally pinned by two tests as literal strings: covers/index.test.ts:41 and goodreads.test.ts:98. So the finding's own consequence argument ("if OpenLibrary changed its cover URL scheme, two files in two directories would need editing") actually understates: eight hardcoded instances across three modules plus two tests. This strengthens the observation while making it less actionable, since converting six data literals into function calls would be a net readability loss.
>
> AMENDMENT 2 - "DUPLICATION" IS THE WRONG WORD. The two functions share only a hostname and the `-L.jpg` suffix; they are two different endpoints of the same public API, not two copies of one thing. `coverForIsbn` (goodreads.ts:121-123) is pure, synchronous, zero-network, keyed on `/b/isbn/`, and returns `undefined`. `fetchOpenLibraryCover` (covers/openLibrary.ts:1-8) is async, issues a request to a DIFFERENT host (`https://openlibrary.org/search.json` at :3) to resolve a `cover_i`, is keyed on `/b/id/`, and returns `null`. No logic is duplicated. The accurate framing is single-source-of-truth for one URL TEMPLATE, not duplicated construction.
>
> AMENDMENT 3 - CATEGORY. `co-location-scattered` per the spec means "related FILES (component + hook + store + test) scattered across multiple top-level directories". Nothing here is a scattered file group; this is one small function arguably filed in the wrong module. Amended to `other`. Severity `low` stands.
>
> AMENDMENT 4 - THE PLACEMENT IS DEFENSIBLE AS-IS, so this is observational. `coverForIsbn` is not incidentally in goodreads.ts: its docstring at goodreads.ts:120 reads "Free cover from an ISBN, when Goodreads gave us one", its input type is `GoodreadsRow.isbn13` (declared goodreads.ts:8 in the same file), and its single production call site (useLibrary.tsx:158) sits inside the Goodreads CSV import loop (verified by reading useLibrary.tsx:142-162 - it is the per-row `bookRepo.create` inside `importGoodreads`). Filing it with the Goodreads import concern is as coherent as filing it with cover sourcing. Choosing between two coherent placements is exactly the convention preference the spec excludes from findings.
>
> THE CAVEAT IS CORRECT AND MUST SURVIVE, with one precision fix. The finding is right that the two cover paths must stay behaviourally separate: `fetchCover` (covers/index.ts:12-21) loops two lookups, each issuing at least one `fetch` (googleBooks.ts:9, openLibrary.ts:3), so routing a Goodreads import through it would mean up to 2-3 HTTP requests per book. Precision fix: the CLAUDE.md invariant actually quoted is about AI calls, and `fetchCover` makes none - covers/index.test.ts:63-75 explicitly asserts it never hits a Gemini endpoint. So the constraint here is cost/latency on large imports, not the AI-call invariant literally. Directionally the caveat is right and the two paths must not be merged.
>
> belongsIn = structural-observations-only: route to `## Structural observations` -> `### Shared module opportunities`, recording that the OpenLibrary cover-CDN URL template is hardcoded in three modules plus two tests and that only one of them lives under src/lib/covers/, with the explicit note that unifying the two CODE PATHS is forbidden by the zero-network import requirement.

### F007 · A dead `Category` enum is the only thing stopping the shared types file from being fully erasable

**Low · Other · `src/types.ts:6` · 110 lines · fan-out 33 (high) · discovery · confirmed**

- **What's wrong:** `src/types.ts` exports an enum that nothing in the repository imports. It is the file’s only declaration that survives compilation — every other export is a type alias or an interface.
- **Why it matters:** The repo’s most-imported module is nominally a mixed type-plus-runtime module because of one dead declaration. There is also a latent gap: `Book.category` is declared `string`, so the enum that exists to constrain the field does not constrain it, and test fixtures accordingly use bare string literals.
- **What to do:** Delete the enum. No importer anywhere needs to change. Do not narrow `Book.category` to the enum in the same change — that is a breaking type change needing an IndexedDB migration path, and it would break Goodreads import, which writes free-text shelf names.
- **Confidence:** High — a word-boundary search returns exactly five hits repo-wide, all of them label text, a comment, a markdown template or the declaration itself.
- **Technical detail:** `src/types.ts:6-15`; all 35 import statements targeting the module are `import type`, and there is no value import, no `import * as` and no re-export of the module anywhere.

**Verifier note**

> CONFIRMED - the enum is genuinely dead and genuinely the module's only runtime-emitting declaration. Both claims verified exhaustively; this is the only item in batch V02 with a concrete, zero-risk, mechanical action, so it stays a finding.
>
> LINE COUNT: `wc -l src/types.ts` = 110. Confirmed, far under the 300 floor - correctly NOT filed as a split.
>
> CLAIM 1, DEAD: `grep -rnw "Category" src/` returns EXACTLY 5 hits, matching the finding hit-for-hit: src/types.ts:6 (the declaration), src/components/BookDetail.tsx:321 (JSX label text "Category"), src/components/StatsView.tsx:133 (a JSX comment `{/* Category Breakdown */}`), src/components/StatsView.tsx:138 (heading text "Category Breakdown"), src/lib/markdown.ts:13 (the literal `**Category:**` inside a markdown template string). Not one is an import or a use of the enum. I extended the check beyond the finding on all four axes the batch brief asked for: (a) type-position uses - none, the 5 hits are the whole set; (b) string-literal uses of member VALUES - `grep -rn "PSYCHOLOGY|'Psychology'" src/` returns a single hit, src/types.ts:7, the declaration itself, so no code round-trips the member values as bare strings either; (c) test files - covered by the same repo-wide -w grep, zero test hits; (d) JSON/config/docs - a repo-wide grep (node_modules, dist, .git, audit-reports excluded) hits only the three src files above plus three design/plan markdown docs under docs/superpowers/. Nothing loadable references it. Also confirmed zero value imports (`grep -rnE "^import \{[^}]*\} from '(\.{1,2}/)+types'" src/` -> no match, exit 1) and zero re-exports (`grep -rnE "export .*from '(\.{1,2}/)+types'" src/` -> no match, exit 1). VERDICT: unreferenced, no ambiguity.
>
> CLAIM 2, ONLY RUNTIME-EMITTING DECL: verified by reading all 110 lines. Lines 1-4 are `export type` aliases (BookStatus, Priority, VoiceName, BlobKind); lines 17, 28, 54, 67, 83, 98, 105 are `export interface` (Profile, Book, Summary, StoredBlob, ReviewCard, LibraryExport, QuizQuestion). `export enum Category` at lines 6-15 is the only declaration that survives type erasure. CORRECT.
>
> FAN-OUT I RE-COUNTED: 35 import statements across 33 files (ProfileView.tsx and QuizModal.tsx each import from '../types' twice - lines 2 and 8, and lines 3 and 4 respectively), which reconciles the finding's "35 import sites" with its 33-entry importingFiles list. Every one of the 35 is `import type`. Zero-cycle claim also holds: types.ts's only line matching an import is none - it imports nothing.
>
> ONE NUANCE THE REPORT SHOULD CARRY (not an amendment - the finding does not overclaim here, it says only "nominally a mixed type+runtime module"): there is NO bundle cost today. tsconfig.json sets `verbatimModuleSyntax: true` and `isolatedModules: true`, and all 35 importers use `import type`, so no module ever value-imports src/types.ts; the file never enters the runtime module graph and the enum ships zero bytes. So the argument for deletion is not bundle weight - it is (i) removing 10 lines of provably dead exported code, and (ii) removing a trap: a reader who finds `export enum Category` will reasonably assume it is the canonical category list, when in fact Book.category is declared `string` at src/types.ts:33 and callers pass bare literals (e.g. useLibrary.tsx:154 writes `category: 'Other'` during Goodreads import). The finding's own note that wiring the enum up instead of deleting it would be a real typing/migration change - not mechanical, out of scope - is correct and should be preserved verbatim in the report; existing IndexedDB records hold arbitrary category strings.
>
> Severity `low` and category `other` both stand - there is no better category and no higher severity fits a 10-line dead declaration. belongsIn = findings: this is the one item in the batch that produces a real row in the Recommended actions table ("delete src/types.ts:6-15", effort trivial, risk none, worth doing yes). The Low section should render it without a Proposed-split table, since no split is proposed.

### F006 · Three modals hand-roll the shell that `components/ui/Dialog` already provides, and the copies have drifted

**Low · Other · `src/components/ui/Dialog.tsx:24` · 53 lines · fan-out 4 (low) · discovery · confirmed**

- **What's wrong:** The chat drawer, the quiz modal and the daily-wisdom card each rebuild the same modal root, click-to-close backdrop and dialog panel that the shared `Dialog` primitive provides. Four verbatim-structure copies of the same ten lines.
- **Why it matters:** The copies drifted, which is how the missing close-button labels in F003 happened. But the chrome genuinely differs between them, and forcing them onto the shared primitive would mean bolting at least four config props plus a drawer layout mode onto a 53-line component.
- **What to do:** Nothing structural. Treat the current factoring as intentional — the shared *behaviour* is already correctly extracted into `useFocusTrap` — and fix only the drift, which is F003.
- **Confidence:** High — confirmed, including every claim that argues against acting on it.
- **Technical detail:** `src/components/ui/useFocusTrap.ts:7-12` documents the arrangement explicitly ("shared by `Dialog` and by the modals that keep their own chrome"); the three hand-rolls at `ChatModal.tsx:86-99`, `QuizModal.tsx:96-107` and `DailyWisdomModal.tsx:25-35` differ in layout, z-index and backdrop opacity in ways Dialog’s single `size` prop cannot express.

**Verifier note**

> CONFIRMED AS AN ACCURATE OBSERVATION - every single checkable claim in this merged finding survived independent verification, including the ones that argue AGAINST acting on it. But it is not a decomposition finding and its own text says so, so it belongs in structural observations, not the numbered Low section.
>
> LINE COUNTS I RE-MEASURED: Dialog.tsx 53. Whole components/ui lot: ConfirmDialog 73, Dialog.test.tsx 94, Dialog 53, Toast 55, toastStore.test 41, toastStore 44, useFocusTrap 63 - largest is Dialog.test.tsx at 94, exactly as claimed, so nothing in this lot is within 200 lines of the 300 floor. Modals: AddBookModal 285, QuizModal 254, ChatModal 182, DailyWisdomModal 105 - all four figures exact.
>
> FAN-OUT I RE-GREPPED: 4 import sites for Dialog, and they are exactly the four listed - AddBookModal.tsx:15, ui/ConfirmDialog.tsx:3, ui/Dialog.test.tsx:5, features/settings/ApiKeyDialog.tsx:7.
>
> (a) WHAT THE PRIMITIVE PROVIDES - Dialog.tsx:23-51: `fixed inset-0 z-50` root (:24), click-to-close backdrop with data-testid (:25-29), panel carrying ref + role="dialog" + aria-modal="true" + aria-labelledby={titleId} (:30-35) with titleId from useId() (:17), a header row with an h2 and a close button labelled aria-label="Close" (:41-47), and a scrollable body (:49). One `size` prop only. Confirmed 53 lines, single cohesive responsibility.
>
> (b) THE THREE HAND-ROLLS ARE REAL, all verified by reading: ChatModal.tsx:86-99 (z-[60], bg-gray-900/20, `flex justify-end`, h-full, slide-in-from-right - a right-edge drawer); QuizModal.tsx:96-107 (z-[70], bg-gray-900/50, sr-only h2 at :109-111 so no visible header row); DailyWisdomModal.tsx:25-35 (z-[100], bg-gray-900/60, gradient band at :37 bleeding to the panel edge, absolutely-positioned close button at :39-45). All three carry role/aria-modal/aria-labelledby verbatim. The chrome differences are real and are not expressible through Dialog's single `size` prop.
>
> (c) THE DIVERGENCE IS DOCUMENTED AS DELIBERATE - CONFIRMED VERBATIM. src/components/ui/useFocusTrap.ts:7-12 reads: "Modal keyboard behaviour, shared by `Dialog` and by the modals that keep their own chrome (the chat drawer, the quiz, the daily wisdom card): focus moves in on open, Tab cycles within the panel, Escape closes, and focus returns to whatever opened it." The quote in the finding is exact. And all four DO call it: Dialog.tsx:19, ChatModal.tsx:34, QuizModal.tsx:31, DailyWisdomModal.tsx:22. So the behavioural a11y contract genuinely is single-sourced and the divergence is an documented, intentional chrome-only divergence. That means "these should reuse Dialog" would be a pure convention preference, which the spec bars - and the finding correctly refuses to recommend it. This is why it is an observation, not a defect.
>
> (d) Z-INDEX LADDER - CLAIMS VERIFIED, BOTH COLLISIONS REAL, BOTH CURRENTLY RESOLVE CORRECTLY. Grepped every z-index in src/. Modal ladder: Dialog.tsx:24 z-50, ChatModal.tsx:86 z-[60], QuizModal.tsx:96 z-[70], DailyWisdomModal.tsx:25 z-[100]. Collisions: ui/Toast.tsx:30 is also z-[60] (ties ChatModal) and AudioPlayer.tsx:104 is also z-[100] (ties DailyWisdomModal). Both ties resolve in favour of the intended winner today, purely by JSX order in AppShell.tsx: `<Outlet />` is at AppShell.tsx:176 (ChatModal renders inside it via BookDetail.tsx:30) while `<ToastHost />` is at AppShell.tsx:218, so toasts paint over the drawer; AudioPlayer is at AppShell.tsx:201 and DailyWisdomModal at AppShell.tsx:206-216, so the wisdom card paints over the player. Nothing is broken today - correct, as stated - but the correctness rests on source ordering in one file, not on the numbers. (Also worth noting for the record: EReader.tsx:254 is z-50, tying Dialog, and AppShell.tsx:183's mobile FAB is z-50 too - so the ladder is even less of a single source of truth than the finding says. Does not change the verdict.)
>
> SECONDARY CLAIMS ALSO VERIFIED: aria-label="Close" exists at exactly two places repo-wide, Dialog.tsx:43 and DailyWisdomModal.tsx:41; the close buttons at ChatModal.tsx:116-121 and QuizModal.tsx:167-172 have no accessible name (confirmed by reading both - icon-only &lt;X> children, no aria-label). Dialog.test.tsx:23 asserts aria-modal and :82 clicks dialog-backdrop; smoke.test.tsx:82 is `expect(screen.getAllByRole('dialog')).toHaveLength(1);` under the comment at :81, reached via the AddBookModal -> ApiKeyDialog path only. A grep of every *.test.ts/*.test.tsx for ChatModal|QuizModal|DailyWisdomModal returns ZERO hits - the three hand-rolled panels genuinely have no test coverage. AppShell.tsx:50-53 does close the opener before showing the key dialog, with the two-focus-traps comment, as claimed.
>
> PLACEMENT: everything actionable here is either filed elsewhere (the missing aria-labels, as L08-F02, which is an a11y bug outside this audit's class) or explicitly not recommended (the ModalShell extraction, correctly refused as configurability-before-need). What remains is an accurate shared-module observation with no split and no recommended action. Route it to `## Structural observations` -> `### Shared module opportunities`, carrying the z-index-ladder note (four magic numbers across four files, two ties resolved only by AppShell JSX order) as the one durable risk worth recording.

### RT-F002 · The React-free layering rule is scoped to `.ts` and silently skips `.tsx`

**Low · Other · `eslint.config.js:32` · 37 lines · fan-out n/a · red team · confirmed**

- **What's wrong:** CLAUDE.md declares that `src/lib/**` imports no React and that ESLint enforces it. The enforcing block’s file glob is `src/lib/**/*.ts`, which does not match `.tsx`, and the only other block covering those files carries no import restriction.
- **Why it matters:** This is the guard rail that governs where extracted modules are allowed to land. Anyone pulling pure logic out of an oversized component toward `src/lib/` gets a correct hard error if the new file is `.ts` and silent acceptance if it is `.tsx` — which is the natural instinct when the extracted unit still contains a hook or any JSX. The failure mode is a green lint on a commit that breaks a documented architectural invariant.
- **What to do:** Widen the glob to `src/lib/**/*.{ts,tsx}`. Latent today — all 37 tracked files under `src/lib/` are `.ts` — so this is preventive, and it should be fixed before any split work starts rather than after.
- **Confidence:** High — the enforcing block and the only other matching block were both read in full.
- **Technical detail:** `eslint.config.js:32` reads `files: ['src/lib/**/*.ts']`; the only other block matching those files is `files: ['**/*.{ts,tsx}']` at `:10-29`, whose rules do not include `no-restricted-imports`. None of the current split candidates trips this — their splits stay inside `src/components/` as sibling `.tsx` files.

**Verifier note**

> Phase 4 red-team finding — filed directly by the cross-cutting sweep and not routed through Phase 3 verification. Its evidence was gathered first-hand by the class subagent against the source at the audited commit.

## Files documented as inherently monolithic

Files where size is the point, not a smell. Splitting any of these would hurt readability, fragment a contract, or simply be undone by the next codegen / config edit. **No action is recommended for any row.**

| File | Lines | In scope | Reason |
| ---- | ----- | -------- | ------ |
| `package-lock.json` | 4884 | no | npm lock file — machine-generated resolved dependency graph, rewritten wholesale by `npm install`; the only file in the repo over 1000 lines and the only one genuinely large by design. |
| `src/components/EReader.tsx` | 477 | yes | Self-contained reader that CLAUDE.md documents as deliberately owning its own three-theme system; the available split cuts that palette across two files for a still-oversized ~344-line residual and a permanently single-consumer child — see RT-F001, and contrast F004. |
| `src/lib/storage/migrate.ts` | 151 | yes | One-shot localStorage-to-IndexedDB migration with its own `LegacyBook` shapes — a self-contained per-version snapshot that should stay deletable as a single unit when the legacy path retires. |
| `src/types.ts` | 110 | yes | Exhaustive domain model (4 unions, 7 interfaces, 1 enum) and the single source of truth every layer imports; splitting into per-feature type files would fragment the contract and invite drift. |
| `src/lib/ai/schemas.ts` | 97 | yes | Three exhaustive Gemini response-schema literals, each an indivisible JSON schema mirroring one API call; size is the schema, not accreted logic. |
| `src/lib/ai/prompts.ts` | 82 | yes | Seven prompt template strings — the file's size is the prompt text itself, and co-locating them is what keeps tone and instructions consistent across AI calls. |
| `src/features/review/reviewQueue.test.tsx` | 159 | no | Comprehensive test for one unit — test files are out of scope by spec; splitting yields partial-coverage files nobody can navigate. |
| `src/lib/storage/migrate.test.ts` | 153 | no | Comprehensive test for one unit (the legacy migration), covering every branch of a path that runs exactly once per user — correct as-is. |
| `src/lib/storage/repo.test.ts` | 123 | no | Integration test for the whole repository surface; the boundary it tests is one module, so the test belongs in one file. |
| `src/features/library/useLibrary.test.tsx` | 119 | no | Comprehensive test for one hook — out of scope by spec; the ten other test files in the repo (87-115 lines) are the same case. |
| `src/features/library/recommendationDefaults.ts` | 45 | yes | Static seed data (default recommendation list plus two cache constants) — the file size IS the data; no logic to separate. |
| `eslint.config.js` | 37 | no | Build config — out of scope by spec; the flat-config array is one cohesive rule set including the `src/lib/**` no-React layering guard. |
| `vite.config.ts` | 26 | no | Build config — out of scope by spec; also carries the Vitest `pool: 'threads'` Windows workaround documented in CLAUDE.md and must stay a single unit. |

_Note the second row: `src/components/EReader.tsx` appears here **and** as F004, a split candidate. That contradiction is adjudicated in the Low section under RT-F005 — this report recommends leaving it whole._

## Structural observations (documentation only)

Everything in this section is observational. None of it is a numbered finding, and none of it should be actioned without a deliberate team decision.

### Directory structure

No directory in this repo comes close to the 20-file bar, so there is no overcrowding finding to file. The largest directory at any single level is `src/lib/ai` at 13 files, tied with the repo root (13, of which only 2 are source); next are `src/lib` at 12, `src/components` at 10, and `src/components/ui` and `src/features/library` at 7 each. Counting three ways changes nothing: the highest source-only count is 11 (`src/lib/ai`) and the highest test-only count is 6 (`src/lib`). Co-located tests are therefore NOT masking an overcrowded directory anywhere — the largest directory is the one where tests contribute least (2 of 13), and `src/components`, the directory an auditor would most expect to be crowded, holds zero co-located tests at all. The project follows a deliberate hybrid consistently: layer-based at the top (`src/app` shell, `src/lib` React-free logic, `src/components` shared UI, `src/features` routes), domain-based one level down inside `src/lib` (`ai/`, `audio/`, `covers/`, `storage/`), and feature-based inside `src/features` (six folders, zero loose files at that level, no barrel). `src/components/ui/` is the single in-repo precedent for grouping within `components/`, and it groups by kind (headless primitives), not by feature surface — so a further by-surface taxonomy such as reading/modals/cards has no precedent in this codebase and is deliberately not recommended. Two mild drifts are worth recording as documentation only. First, `src/lib` is shaped inconsistently: four domains earned subdirectories while six leaf modules (`base64`, `contrast`, `download`, `goodreads`, `markdown`, `srs`) stayed flat beside them, and CLAUDE.md lists all of them as if they were peer subdirectories — a one-line doc accuracy nit, not a restructure, since `src/lib/audio/` proves single-module folders are acceptable here but 12 files is 8 under threshold and the split reads cleanly as 6 utilities plus their 6 tests. Second, and more substantively, several of the largest components in the flat `src/components` layer have exactly one importer each and sit apart from the feature that owns them (`BookDetail.tsx` ← only `features/book/BookDetailPage.tsx`; `EReader.tsx` ← only `features/book/ReaderPage.tsx`; `ProfileView.tsx` ← only `features/profile/ProfilePage.tsx`; `StatsView.tsx` ← only `features/stats/StatsPage.tsx`), while genuinely shared members of the same directory (`AudioPlayer`, `AddBookModal`, `DailyWisdomModal`, `BookCard`, and all of `ui/`) are correctly placed. That is a co-location question about directory membership, not about directory size, and it belongs to the co-location analysis rather than here. Finally, the cost side is unusually unforgiving in this repo and argues for leaving the structure alone: `tsconfig.json` declares no `compilerOptions.paths` and `vite.config.ts` declares no `resolve.alias`, so all 244 import specifiers across 69 source files are relative. Any regrouping rewrites specifiers twice over — in every importer and in every moved file's own imports, where added depth turns `./x` into `../x`. The two nearest-threshold directories illustrate the scale: regrouping `src/components` would touch roughly 24 specifiers across 13 files, and regrouping `src/lib/ai` roughly 51 across 18 files (21 external plus 30 internal), the latter against a tight hub-and-spoke graph in which all five capability modules depend on four or five of the same five shared modules, so no subdirectory boundary would actually reduce coupling. Conclusion: the directory structure is proportionate to a codebase of 87 source files under `src/`, follows its documented pattern without meaningful drift, and requires no grouping action.

### Barrel file assessment

The codebase has exactly one barrel — `src/lib/covers/index.ts`, 22 lines — and it is helping rather than hurting, so the correct recommendation is to leave the barrel situation exactly as it is. It is better described as a facade than a barrel: it contains a single re-export (`export { placeholderCover };`) alongside 11 lines of its own policy logic, the `fetchCover` function that tries Google Books, then OpenLibrary, then falls back to a locally generated placeholder. Because `fetchCover` is defined there and nowhere else, importing through the module is the only route to it — consumers are not taking an ergonomic shortcut past the real modules. It deliberately withholds `fetchGoogleBooksCover` and `fetchOpenLibraryCover`, narrowing the directory's four symbols to a public two so no caller can fire a single unguarded network lookup and skip the fallback chain. All five external consumers (`BookCard.tsx`, `RecommendationCarousel.tsx`, `useLibrary.tsx`, `ai/recommend.ts`, `ai/summarize.ts`) import through it and zero bypass it to reach the concrete modules. Circular-dependency masking is structurally impossible: `googleBooks.ts`, `openLibrary.ts` and `placeholder.ts` contain no import statements at all, so nothing can point back. Tree-shaking is a non-issue for three independent reasons — the leaf modules are pure function declarations with zero module-level side effects, the app builds to a single bundle (no `manualChunks`, no dynamic `import()`, no `React.lazy`), and `fetchCover` is used by the AI modules anyway so its dependencies are in the bundle regardless. Beyond this one file the repo contains zero `export ... from` statements anywhere, meaning no de-facto barrels and no import-graph opacity: every symbol in the project is imported from the file that defines it. That absence is a real strength of this codebase's structure and should be preserved. Accordingly this report recommends no new barrels — not for `src/components/`, not for `src/components/ui/`, not for the files extracted by F001, F002 and F004, all of which land as flat siblings in `src/components/` and should be imported directly by path. Two specific temptations to refuse: folding the `Profile*` trio from F002 into a `src/components/profile/` subdirectory with an `index.ts`, and re-exporting the `Theme` type back out of `EReader.tsx` after F004 moves it to `ReaderContent.tsx`. Either would introduce a convention the project does not have, which this audit's spec places out of scope; the one barrel that exists earned its place by owning behaviour, and a pass-through export list would not.

**One operational addition from the reference sweep.** All five consumers of `src/lib/covers/index.ts` import it by *directory name* — `from '.../covers'` with no filename — at `src/components/BookCard.tsx:3`, `src/features/library/RecommendationCarousel.tsx:3`, `src/features/library/useLibrary.tsx:7`, `src/lib/ai/recommend.ts:6` and `src/lib/ai/summarize.ts:6`. The filename `index.ts` is therefore load-bearing: renaming it, or "flattening the barrel", breaks all five call sites at once. This one fails safely (TypeScript errors), unlike the repo’s other path pins — `index.html:21 -> src/main.tsx` and `vite.config.ts:22 -> src/test/setup.ts`, neither of which any compiler or linter checks.

### Co-location opportunities

The repo's co-location conventions hold, and nothing here calls for a co-location refactor. Twelve logical units were mapped file-by-file; seven span 4+ top-level directories, but in every one of those cases the spread is the project's own documented architecture rather than drift. Two rules account for almost all of it. First, the ESLint-enforced layering invariant (`src/lib/**` imports no React; `src/features/**` and `src/components/**` never touch `idb` or `@google/genai` directly) forces every unit's non-React logic out of its feature folder and into `src/lib/<domain>/`, which is why quiz spans five directories while having exactly one unit-exclusive file (`QuizModal.tsx`) and why audio spans six. Second, the page-wrapper-in-`features/` over view-in-`components/` shape is the dominant route convention -- it holds for BookDetail, EReader, StatsView and ProfileView, each a single-importer view -- with library and review using a more self-contained minority shape that deviates *toward* co-location, not away from it. Stats, the unit most often suspected of a mismatch, spans only three directories and does not clear the bar at all. Goodreads import is the repo's best-co-located unit and the model for the rest: the parser and the import UI each carry a test file in their own directory. One genuine deviation was recorded (documentation only, RT-F007): the audio unit is the widest in the codebase at six directories, and the single contract binding those layers together -- `AudioTrack`, a four-field pure-data interface with no React in it -- is declared inside `src/components/AudioPlayer.tsx` rather than in `src/types.ts`, which is the established home for all eleven other cross-layer shapes. The consequence is that `src/app/ShellContext.ts`, the shell's public API surface that otherwise imports nothing at all from the components tree, must reach sideways into a UI leaf for a type; a repo-wide sweep confirms this is the only such case, since every other cross-directory type export originates in `src/lib/**` or is a hook exporting its own parameter types. On tests: the CLAUDE.md claim that tests live beside their subject is accurate -- 20 of 21 test files sit in their subject's directory (17 as exact `foo.ts` -> `foo.test.ts` stem matches), and the one exception, `src/test/smoke.test.tsx`, is a deliberately isolated whole-app smoke suite with no single file subject. No test lives in a different top-level directory from its subject. The real gap the test survey exposes is absence rather than scatter: coverage is effectively total in the React-free layer (`src/lib` flat is 6 of 6) and effectively absent in the UI layer -- `src/components` holds ten source files including the repo's three largest (BookDetail 539, EReader 477, ProfileView 439) and contains no test file at all, with `src/features/book` and `src/features/stats` likewise untested. Those components are exercised only indirectly, through `src/app/routing.test.tsx` and `src/test/smoke.test.tsx`, both of which are correctly placed for what they are. That is a test-coverage observation, outside this audit's remit, but it is the reason `src/components` looks under-co-located when it is in fact merely under-tested.

### Shared module opportunities

The audit found no missing shared module and no premature one. It did surface three facts about the repo’s shared surface that any future split must price in, and two things it explicitly recommends against sharing.

**`src/types.ts` is the most-imported module in the codebase, and the most expensive file in the repo to ever move.** It has 33 distinct importing files across 35 import statements, and **every one of them is type-only**. Nothing else is close — second place is `src/features/profile/ProfileContext.tsx` at 18. At 110 lines it is nowhere near the decomposition threshold and it should not be split: it is the single source of truth every layer resolves its shapes through, and fragmenting it into per-feature type files would invite exactly the drift it prevents. The cost note matters because the project has zero path aliases: relocating it would rewrite a relative specifier in 33 files, and if the directory depth changed, inside the moved file too. It is also the only file in the repo that clears the `oversized-high-fan-out` category’s import bar — and it misses the line bar by 190 lines, which is why that category has zero findings.

**`src/lib/ai/errors.ts` is the most-imported runtime module**, with 12 production importers (14 counting tests) — more than any other module that actually emits code. At 64 lines it is correctly sized and correctly placed. It is recorded here because it is the one runtime module whose shape a decomposition pass must not disturb: it reaches into `src/app`, `src/components`, `src/features/settings` and five of the `src/lib/ai` capability modules.

**The one genuine placement deviation is `AudioTrack`** (RT-F003), declared at `src/components/AudioPlayer.tsx:4-9` rather than in `src/types.ts` where the other eleven cross-layer shapes live. It is a four-field, React-free data interface with no reason to live in a presentational component, and the cost is concrete: `src/app/ShellContext.ts` — the shell’s public API surface, which otherwise imports nothing at all from the components tree — must reach sideways into a UI leaf to describe its own `playAudio` method. Moving it introduces no new pattern, because `src/types.ts` *is* the pattern already. It remains optional.

**Do not add barrel files** anywhere as part of a split — not for `src/components/`, not for `src/components/ui/`, and not for the files F001 and F002 would create. The one barrel that exists earned its place by owning behaviour; a pass-through export list would be a convention this project does not have.

**Do not unify the two `formatInline` helpers.** `src/components/BookDetail.tsx:34-53` and `src/components/EReader.tsx:33-51` are verbatim logic duplicates — identical signature, identical split regex, identical guards, slices, keys and element choices — differing only in **two className string literals** each. They must stay separate anyway. BookDetail’s variant emits `dark:` variants that participate in the global `.dark` class system; EReader’s deliberately emits colour-inheriting classes (`inherit-color`, `opacity-90`) so the reader’s own light/sepia/dark themes win — the exclusion CLAUDE.md documents. Collapsing them into one helper forces one class set on both and breaks the reader themes; collapsing them into `formatInline(text, classNames)` is a function-signature change, which this audit’s spec forbids as part of a decomposition. **If F001 is executed, the new `SummaryRenderer.tsx` will carry its own copy — that is correct and intentional, and a future session must not "helpfully" DRY them.**

## Recommended actions

Ordered by risk descending. "Worth doing?" is answered honestly — over-splitting is worse than under-splitting, and not every flagged file is worth its migration cost. Rows 6 through 9 all depend on row 1.

| # | Recommendation | File(s) | Impact | Risk if ignored | Effort | Worth doing? | Details |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Write a characterization test for a file **before** splitting it | `src/components/BookDetail.tsx`, `EReader.tsx`, `ProfileView.tsx` | Gives the split discipline something to actually run | High — `src/components/` has 10 source files and 0 tests, so every split below would land with no automated backstop | Moderate | Yes — prerequisite | Blocking dependency for rows 6, 7, 8 and 9. Existing coverage reaches these files only indirectly via `src/app/routing.test.tsx` and `src/test/smoke.test.tsx`. Co-locate per convention (`BookDetail.test.tsx` beside its subject). |
| 2 | Delete or wire up the dead "Privacy Mode / Local storage encryption" toggle | `src/components/ProfileView.tsx:385-387` | Removes a false security claim from the UI | High — the app advertises encryption at rest that does not exist, on a project heading for a public open-source launch | Trivial | Yes | RT-F001. Also an a11y defect (cursor-pointer div, no role, no keyboard affordance). Decide before any settings extraction carries it forward. |
| 3 | Move `key={currentPage}` out of the className string and onto the element | `src/components/EReader.tsx:393` | Restores the page-turn animation | Medium — the reader's headline transition has never replayed after page one, and three junk CSS classes ship on every render | Trivial | Yes | RT-F004. Invisible to typecheck, lint, Prettier and the test suite — nothing mounts the reader. One-off; a repo-wide grep found no second instance. |
| 4 | Add `aria-label="Close"` to the two unlabelled modal close buttons | `src/components/ChatModal.tsx:116`, `src/components/QuizModal.tsx:167` | Close control becomes announceable | Medium — screen-reader users get an unnamed primary dismiss control on two modal dialogs | Trivial | Yes | F003. Matches `Dialog.tsx:43` and `DailyWisdomModal.tsx:41`, which already do it. Escape still closes both, so it is degraded rather than trapped. |
| 5 | Widen the ESLint layering glob to `src/lib/**/*.{ts,tsx}` | `eslint.config.js:32` | Restores the guard rail that governs where extractions may land | Medium — an extraction placed at `src/lib/**/*.tsx` can import React with lint staying green, silently breaking a documented invariant | Trivial | Yes — do it before row 6 | RT-F002. Latent today (all 37 files under `src/lib/` are `.ts`), but it is precisely the rule a decomposition pass leans on. One character. |
| 6 | Extract `SummaryRenderer` from `BookDetail.tsx` (539 → ~450) | `src/components/BookDetail.tsx` → new `src/components/SummaryRenderer.tsx` | Separates a pure text-transformation primitive from a screen; makes 83 lines unit-testable for the first time | Low — refactor benefit only; the code works today | Moderate | Yes | F001 step 1. The cleanest boundary in the repo: the interface `{ text: string }` already exists in the source and is already honoured at the single call site, so this is a move, not an abstraction. Fan-out 1, no importer changes. Depends on row 1. |
| 7 | Extract `ProfileDataManagement` from `ProfileView.tsx` (439 → ~306) — **step 1 only** | `src/components/ProfileView.tsx` → new `src/components/ProfileDataManagement.tsx` | Separates the app's data-portability surface from a settings screen and isolates its only real branching logic | Low — refactor benefit only | Moderate | Yes — but do **not** do the proposed step 2 | F002. Zero shared state; state moves *down*, nothing is drilled. The proposed `ProfileSettings` extraction exists only to carry the residual under 300 lines and is explicitly not recommended — leaving the parent at ~306 is the right outcome. Depends on row 1. |
| 8 | Delete the dead `Category` enum from `src/types.ts` | `src/types.ts:6-15` | Makes the repo’s most-imported module 100% type-only and fully erasable | Low — dead code only | Trivial | Yes | F007. Zero importers to update; all 35 import statements targeting the module are `import type`. Do **not** narrow `Book.category` to the enum in the same change — that needs a storage migration and breaks Goodreads import. |
| 9 | Extract `BookNotesEditor` from `BookDetail.tsx` | `src/components/BookDetail.tsx` → new `src/components/BookNotesEditor.tsx` | Isolates a self-contained notes cluster behind two props | Low — none | Small | Probably not — optional | F001 step 2. Unlike step 1 this *does* invent a two-prop interface that does not exist today, and a notes textarea is a section of the screen rather than a different level of abstraction. Taste call. Watch the `personalNotes` undefined-vs-`''` save-guard delta if executed. |
| 10 | Replace `handleExport`’s hand-rolled download with the existing `downloadText` helper | `src/components/ProfileView.tsx:98-106`, `src/lib/download.ts:2` | Removes an inlined duplicate of an existing helper | Low — duplication only | Trivial | Probably | F002 step 3. `downloadText` already accepts the MIME type as its third parameter. Separate commit — do not bundle with the extraction. |
| 11 | Split `EReader.tsx` into `EReader` + `ReaderContent` | `src/components/EReader.tsx` | Would make 111 lines of themed rendering independently testable | Low — none. The file is coherent as it stands | Moderate | **No** | F004 versus RT-F005, adjudicated in the Low section. The split cuts 7 of 13 reader-theme mappings across two files against a CLAUDE.md invariant naming this file, forces the shell to import its own state’s type from its child, and still leaves a ~344-line parent. The red team independently rated it the weakest of the three candidates. Over-splitting is worse than under-splitting. |
| 12 | Move the `AudioTrack` interface to `src/types.ts` | `src/components/AudioPlayer.tsx:4-9` → `src/types.ts` | Stops `src/app/ShellContext.ts` reaching into a UI leaf for a type | Low — none; discoverability only | Trivial | Optional | RT-F003. Introduces no new pattern — `src/types.ts` already holds the other eleven cross-layer shapes. The other five directories the audio unit spans are architecturally mandated and must not move. |
| 13 | Leave the modal shells, the covers barrel and the cover-URL locality exactly as they are | `src/components/ui/Dialog.tsx`, `src/lib/covers/index.ts`, `src/lib/goodreads.ts` | Avoids three refactors that would each make the code worse | None | None | No — deliberately | F006, F008 and the barrel survey. Absorbing the three hand-rolled modals into `Dialog` needs 4+ config props on a 53-line primitive; the covers barrel earns its place by owning `fetchCover`; and the Goodreads path must keep its zero-network URL builder or a large import becomes 2-3 HTTP requests per book. |

**Sequencing discipline, per the spec:** one file at a time, and run `npm run typecheck && npm run lint && npm run format:check && npm test` after every single step. Bulk splits hide which split broke which test — and in `src/components/` there is barely a test to break, which is why row 1 comes first. **Never rename while moving:** a split moves code between files and updates import paths, nothing else.

## Uncertain findings

None. Every aggregated finding reached a definite verdict in Phase 3.

## Refuted findings (transparency appendix)

One discovery finding was refuted. Refuting the finding *status* does not impugn the discovery work — the auditor investigated a hypothesis and correctly reported that it does not hold. The content is preserved in the structural observations above.

- **F005** — `src/components/StatsView.tsx` (238 lines, severity low, category `co-location-scattered`) — Documentation only: StatsView/ProfileView live in components/ while their feature folders hold only thin page wrappers - this is the established convention, not a defect
  - **Why refuted:** the file is 238 lines, under the 300-line floor, and its `proposedSplit` is empty; its own text reads "the mismatch hypothesis is NOT supported" and its own `worthDoing` is "no". Under the spec it is simultaneously "file is under threshold", "file has a single coherent responsibility", and a convention-preference item, which the scope rules bar from being a finding. Every factual claim in it was independently re-measured and holds — the page-wrapper-over-`components/` shape is the codebase’s dominant convention (4 of 6 routes), not drift.

## Audit metadata

- Audit type: file-decomposition
- Spec: `~/.claude/audit-types/file-decomposition.md`
- Target repo: `C:\Software Projects\BookSum\.worktrees\audit-file-decomposition`
- Audited commit: `01fa100764b1ae48b84a4d7b2b73ad3e0a8d28be` (branch `audit/file-decomposition`)
- Run mode: read-only — no source file was modified; fix suggestions live in `findings.json` `suggestedPatch`
- Started: 2026-08-12T13:50:00Z
- Completed: 2026-08-12T16:27:30.396Z
- Total source files inventoried: 94 (64 in scope, 30 excluded as test / config / generated / styles)
- Files >300 lines: 3
- Files >500 lines: 1
- Files >1000 lines: 0
- Files >2000 lines: 0
- Largest file: `src/components/BookDetail.tsx` at 539 lines
- Established module-organization pattern: **mixed** (layer-based top level, domain-based inside `src/lib`, feature-based inside `src/features`)
- Barrel files in use: **partial** — exactly one (`src/lib/covers/index.ts`, 22 lines)
- Path aliases: **none** (0 declared in either `tsconfig.json` or `vite.config.ts`)
- Import graph: 86 modules, 244 internal code-to-code edges, **0 cycles**
- Lots: 11
- Raw discovery findings: 9
- After dedup: 8
- Verifier verdicts: 6 confirmed / 1 amended / 1 refuted / 0 uncertain
- Red-team classes: 9
- Red-team findings: 5
- **Final live-finding count: 12**

**Known limitation of this audit.** Git history is unusable as a hot/cold or maintenance-pressure signal in this repository — the whole 23-commit history spans two days of a single scripted rewrite. No severity in this report is justified by commit frequency, and one Phase 3 severity justification that did cite specific commits has been withdrawn and re-grounded. A second limitation follows from the first caveat in the executive summary: the three split candidates have no direct automated test coverage, so every recommended split is verified by the type system and two whole-app suites rather than by unit tests.

## Fix Waves

12 live findings across 9 files → **2 waves**. **One wave = one session.** Each wave/session owns related files from one severity tier (up to 9 findings a session). Launching the waves spawns exactly 2 session(s) — one per wave, no hidden fan-out.

> **Drive mode.** Each wave runs autonomously (`/dev-pipeline --auto`) by default — it drives itself to a ready-to-merge tag with no check-ins. Run a wave interactively only if you want to review its steps.

> **Safety & scope.** Each wave OWNS its listed files, but a session may follow a bug to its root cause in a shared file (type, index, helper, test) and fix it there — it NOTES every such out-of-scope edit in its summary. Give each session its own worktree so those edits reconcile at merge. Waves are **priority-ordered, not dependency-ordered** (criticals first), and grouped by folder within a tier so each session works on related code. How many you run at once is a launch-time choice — NOT baked into the plan.

| Wave | Severity | Findings | Files |
| --- | --- | --- | --- |
| W1 | medium | F002, RT-F001, F001 | `src/components/ProfileView.tsx`<br>`src/components/BookDetail.tsx` |
| W2 | low | RT-F002, F007, F004, RT-F004, RT-F005, RT-F003, F003, F006, F008 | `eslint.config.js`<br>`src/types.ts`<br>`src/components/EReader.tsx`<br>`src/components/AudioPlayer.tsx`<br>`src/components/ChatModal.tsx`<br>`src/components/ui/Dialog.tsx`<br>`src/lib/goodreads.ts` |

_The ready-to-run spawn prompt for every wave (one per session) is in `waves.json`._
