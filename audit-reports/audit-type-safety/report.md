# Type Safety Audit — BookSum

| | |
| --- | --- |
| **Target** | `C:\Software Projects\BookSum` |
| **Audited commit** | `01fa100764b1ae48b84a4d7b2b73ad3e0a8d28be` (branch `audit/type-safety`) |
| **Run mode** | read-only — no source file was modified |
| **Completed** | 2026-08-13T07:47:33.001Z |
| **Live findings** | **159** (141 verified + 18 red-team) |

---

## 1. Summary

### The headline: the enumeration half of this audit is a null result

The usual output of a type-safety audit is a list of `any`s and `@ts-ignore`s. This codebase has
none. Measured directly against the AST of all 86 source files:

| Metric | Count | Note |
| --- | --- | --- |
| Explicit `any` (any position) | **0** | ESLint `no-explicit-any` active and clean |
| `@ts-ignore` / `@ts-expect-error` / `@ts-nocheck` | **0** | `ban-ts-comment` active and clean |
| `as unknown as T` double casts | **0** | — |
| `as T` assertions | **18** | 17 production + 1 test; 2.1 per kloc repo-wide |
| Non-null assertions (`!`) | **14** | **4 in production code**, 10 in tests |
| Definite-assignment (`!:`) | **5** | all in test fixtures |
| `strict` sub-flags failing | **0** | including `strictNullChecks` — the codebase is genuinely null-aware |

`npx tsc --noEmit` exits **0**. Every finding in this report is therefore, by definition, something
the project's current configuration does not and cannot catch.

### The actual thesis

> **The danger here is not what the authors wrote. It is what the type system was never told, and
> what typed libraries hand back.**

61 of the 159 findings are **boundary-without-validation** — external data entering typed
code through an assertion rather than a check. The types downstream are not weak; they are
confident and wrong. A `Book` read out of IndexedDB is typed `Book` because a `DBSchema`
declaration says so, not because anything verified it. Gemini JSON becomes `QuizQuestion[]`
because of one `as`. A user-picked backup file becomes `LibraryExport` behind a single
`Array.isArray` check.

Four further holes come from **libraries**, not from this repo, and no amount of local discipline
would have closed them (each proven with a `tsc` probe compiled against the real `node_modules`
under `strict: true`):

1. `@google/genai` types `responseSchema` as `Schema | unknown` → all three AI response schemas are
   checked against nothing.
2. `vite/client` types `import.meta.env` as `Record<string, any>` → the zero-`any` property has an
   unannounced exception exactly where env vars would land.
3. `Promise.prototype.catch`'s `reason: any` (lib.es5) defeats `noImplicitAny` at `AudioPlayer.tsx:29`.
4. `vi.stubGlobal(value: unknown)` + bare `vi.fn()` → the `matchMedia`/`fetch` test mocks are unchecked.

### Severity distribution

| Severity | Count | Share |
| --- | --- | --- |
| Critical | 5 | 3% |
| High | 29 | 18% |
| Medium | 64 | 40% |
| Low | 61 | 38% |
| **Total** | **159** | |

Verification moved these substantially. Before Phase 3 the raw discovery set read
critical 7 / high 45 /
medium 62 / low 34;
after re-checking each finding against source it reads
critical 3 / high 27 /
medium 54 / low 57
(then plus 18 novel red-team findings). 52 demotions, 2 promotions,
7 outright refutations. **The numbers in this report are the post-verification ones.**

### Findings by category

| Category | Count |
| --- | --- |
| **boundary-without-validation** | 61 |
| discriminated-union-opportunity | 27 |
| branded-type-opportunity | 19 |
| tsconfig-strictness-gap | 15 |
| untyped-public-function | 9 |
| type-assertion-as-T | 9 |
| non-null-assertion | 8 |
| unknown-misuse | 5 |
| js-implicit-coercion | 2 |
| generic-opportunity | 2 |
| implicit-any-from-missing-annotation | 1 |
| weak-type-as-Object-or-Function | 1 |

> Categories with a **zero** count, worth stating explicitly because they are what an audit of this
> kind normally reports: `explicit-any-on-boundary`, `explicit-any-internal`, `ts-ignore-suppression`,
> `double-cast-as-unknown-as-T`.

### Language coverage

100% TypeScript. 86 source files, 8,418 lines (64 production files / 6,546 lines; 22 test files /
1,872 lines). Finding density: 18.9 per kloc. No JavaScript-only modules and no Python, so the
spec's JSDoc, mypy and `except:` classes are structurally N/A (recorded in §4).

### External-data boundaries

A complete inventory of all **56** points where untyped runtime data crosses into typed code is in
`findings.json` → `boundaryInventory`. Validation status:

| Validation | Boundaries |
| --- | --- |
| None | 32 |
| Partial | 13 |
| Full | 11 |

By channel: IndexedDB 11, browser API 8, JSON.parse 7, localStorage 7, Gemini 7, file 6, route param 3,
fetch 2, env 2, other 3.

### tsconfig strict-flag gaps

Every measurement below was reproduced independently with the repo’s own `tsc`.

| Flag | Status | Errors if enabled | Adoption cost |
| --- | --- | --- | --- |
| `noUncheckedIndexedAccess` | off | 10 | moderate |
| `exactOptionalPropertyTypes` | off | 9 | moderate |
| `noPropertyAccessFromIndexSignature` | off | 5 | trivial |
| `noImplicitOverride` | off | 1 | trivial |
| `noImplicitReturns` | off | 0 | trivial |
| `noUncheckedSideEffectImports` | off | 0 | trivial |
| `allowUnreachableCode (as false)` | off | 0 | trivial |
| `allowUnusedLabels (as false)` | off | 0 | trivial |
| `skipLibCheck (measured as false)` | on | 2 | significant |
| `strict family (noImplicitAny, strictNullChecks, noImplicitThis, strictFunctionTypes, strictBindCallApply, strictPropertyInitialization, strictBuiltinIteratorReturn, useUnknownInCatchVariables)` | on | 0 | trivial |
| `ALL opt-in flags combined` | off | 25 | moderate |
| `ESLint type-aware tier (parserOptions.project / projectService)` | off | null | moderate |
| `CI gating (informational — NOT a finding)` | on | 0 | trivial |

**The single most actionable configuration finding:** `noUncheckedIndexedAccess` costs exactly **10
errors across 4 component files and zero in `src/lib/**`**. Four more flags cost **0** and are free
ratchets. `strictNullChecks` is already effectively satisfied — there is no multi-week migration
hiding here.

> ⚠️ `noUncheckedIndexedAccess` must land **together with** `@typescript-eslint/no-non-null-assertion`
> (F053). Otherwise the cheapest way to silence all 10 errors is to append `!`, which trades a
> compile-time gap for a runtime crash.

### Top 10 files by weighted type-weakness

| # | File | Findings | Worst | Weighted |
| --- | --- | --- | --- | --- |
| 1 | `src/lib/storage/migrate.ts` | 8 | critical | 33 |
| 2 | `src/types.ts` | 10 | high | 29 |
| 3 | `src/lib/storage/repo.ts` | 10 | high | 20 |
| 4 | `src/components/BookDetail.tsx` | 5 | critical | 19 |
| 5 | `src/components/ProfileView.tsx` | 4 | critical | 17 |
| 6 | `src/lib/ai/summarize.ts` | 4 | high | 14 |
| 7 | `src/features/library/useLibrary.tsx` | 5 | high | 12 |
| 8 | `src/components/QuizModal.tsx` | 3 | high | 12 |
| 9 | `src/components/ChatModal.tsx` | 2 | critical | 12 |
| 10 | `src/lib/ai/chat.ts` | 2 | critical | 12 |

---

## 2. Findings

All 159 live findings. **Critical and high findings are given in full below.** Medium and low
findings are listed compactly — their full description, evidence, verifier note and suggested patch
are in `findings.json`, keyed by id. Nothing is omitted from the data, only from the prose.

Each finding carries a plain-language statement of the user-visible consequence, because several of
these are not abstractions — they are shipped bugs (see §6).

### 2.1 Critical

#### F002 — Chat and Quiz appear on books that have no summary, and using them takes the whole app down

**Critical** · `non-null-assertion` · `src/components/BookDetail.tsx`:534 · discovery (L11) · confidence: high

**What it is.** The book page is written as if every book already has an AI summary, but books added from a Goodreads import deliberately have none. Nothing hides the Chat and Quiz buttons for those books.

**Why it matters.** Anyone who imports their Goodreads library and taps Chat on one of those books loses the entire application to a crash screen and has to reload. Tapping Quiz instead shows a misleading message blaming the AI service for what is really a missing summary.

<details><summary>Technical detail</summary>

CLUSTER of 2 non-null assertions, both on the same optional prop. `BookDetailProps.summary` is declared `Summary | undefined` (line 119) because a book can legitimately exist unsummarised (that is the whole point of the free Goodreads import). `ChatModalProps.summary` and `QuizModalProps.summary` are both declared non-optional `Summary`, so the two render sites at 534/536 use `!` to force the mismatch through the compiler. Nothing gates the buttons that set `showChat`/`showQuiz`: lines 337-353 render them for every non-preview book regardless of whether a summary exists, and `BookDetailPage.tsx:19` only guards `isLoading || !book || !profile` - never `!summary`. FAILURE (chat, line 534): open any Goodreads-imported book -> click Chat -> `ChatModal` mounts -> `useEffect` at ChatModal.tsx:35 calls `createBookChatSession(book, undefined)` -> `chat.ts:14` calls `chatSystemInstruction(book, undefined)` -> `prompts.ts:61` evaluates `${summary.oneSentenceTakeaway}` -> TypeError. That effect has NO try/catch, so the throw escapes the render tree into the error boundary and takes the whole app down to the crash screen. FAILURE (quiz, line 536): `generateBookQuiz(book, undefined)` -> `prompts.ts:48` `${summary.summary}` -> TypeError, but this one is inside `loadQuiz`'s try/catch, so it degrades to a misleading `toAiError` toast that blames the AI service for what is actually a missing-summary state, leaving an empty quiz modal open. BLAST RADIUS: every book in the library that has no Summary record - i.e. the entire result of a Goodreads CSV import, the app's headline free feature. A user who imports 500 books and taps Chat on any of them loses the app. FIX SHAPE: remove both `!` and gate the two buttons on `summary` (or model Book+Summary as a discriminated union, see L11-F02) so the compiler proves the children's requirement instead of being told to trust it.

```
119:  summary: Summary | undefined;
...
337:                {!isPreview && (
340:                      onClick={() => setShowChat(true)}
347:                      onClick={() => setShowQuiz(true)}
...
534:      {showChat && <ChatModal book={book} summary={summary!} onClose={() => setShowChat(false)} />}
535:
536:      {showQuiz && <QuizModal book={book} summary={summary!} onClose={() => setShowQuiz(false)} />}
```

**Verification (confirmed).** Verified end to end, every hop. Current lines: BookDetailProps.summary is `Summary | undefined` at src/components/BookDetail.tsx:119; the Chat/Quiz buttons are gated only by `{!isPreview && (` at line 337 (onClick setShowChat at 340, setShowQuiz at 347); the two assertions are at 534 and 536. Nothing upstream gates on a summary: BookDetailPage.tsx:19 guards only `isLoading || !book || !profile`, and it never passes `isPreview` (lines 39-53), so `!isPreview` is always true on the real route. ChatModalProps.summary is required `Summary` (ChatModal.tsx:11) and QuizModalProps.summary is required `Summary` (QuizModal.tsx:23). CHAT ARM (line 534): ChatModal.tsx:36-38 calls createBookChatSession(book, undefined) in a useEffect; chat.ts:13-16 evaluates `getClient()` first (so with no key you get MissingKeyError instead), then `chatSystemInstruction(book, undefined)` -> prompts.ts:61 `${summary.oneSentenceTakeaway}` -> TypeError. errors.ts:53-61 classifies it as kind 'unknown' (the message has no 'quota'/'safety'/'blocked'/'fetch' and no status), so chat.ts:18 rethrows `AiError('unknown', 'Something went wrong talking to Gemini. Try again.')` out of the effect body with no try/catch. I confirmed that reaches the boundary: routes.tsx:16 puts `errorElement: <ErrorBoundary />` on the root route, and react-router 8.3.0's RenderErrorBoundary (node_modules/react-router/dist/development/lib/hooks.js:645-673) is a real React class error boundary (getDerivedStateFromError + componentDidCatch), which catches throws from descendants' passive effects. The whole app is replaced by 'Something went wrong / Something went wrong talking to Gemini. Try again.' QUIZ ARM (line 536): quiz.ts:12 `quizPrompt(book, undefined)` -> prompts.ts:48 `${summary.summary}` -> TypeError, but this one IS inside loadQuiz's try (QuizModal.tsx:43-68), so it degrades to the misleading toast the description predicts plus an empty 'Could not generate quiz.' modal. Both arms are exactly as described.

**Reachability.** Concrete, no tampering needed. (1) Library -> Goodreads import panel (src/features/library/GoodreadsImport.tsx:97 'Import library' -> useLibrary.tsx:128-166), which creates every book via bookRepo.create with NO summaryId and writes no Summary record (lines 150-160). (2) Click any imported book -> /book/:id (routes.tsx:19). (3) useBookRoute.ts:21 -> summaries.getByBook -> undefined; BookDetailPage.tsx:19 lets it render anyway. (4) The Chat button renders (BookDetail.tsx:337-345) and clicking it mounts ChatModal with summary=undefined. (5) App replaced by the error screen. Secondary path: the same window exists momentarily for EVERY book, summarised or not — useBookRoute.ts:12 initialises summary to `undefined` and only fills it after an async round-trip at line 21, while BookDetailPage.tsx:19 does not wait on it.

**Blast radius.** 2 assertion sites, both in src/components/BookDetail.tsx (534, 536), 1 file. Data blast radius is every Book with no Summary record — i.e. 100% of a Goodreads CSV import, which CLAUDE.md names as the app's headline free feature.

</details>

**Recommended fix.** Only show the Chat and Quiz buttons once a summary actually exists, and remove the two 'trust me, it is there' overrides so the compiler can prove the requirement instead of being told to assume it.

*Feasibility: achievable · Independently re-discovered by the red team as RT-F302*


#### F003 — The chat window insists on a summary that the page opening it cannot promise

**Critical** · `non-null-assertion` · `src/components/ChatModal.tsx`:11 · discovery (L12) · confidence: high

**What it is.** The chat window is declared to always receive a summary, while the only screen that opens it very often has none. The two are reconciled by overriding the compiler rather than by fixing the mismatch.

**Why it matters.** This mismatch is what forces the unsafe override on the book page, and it is the direct cause of the app-wide crash on any unsummarised book.

<details><summary>Technical detail</summary>

ChatModalProps types `summary` as a non-optional `Summary`. BookDetail — the only mount site — holds `summary: Summary | undefined` (BookDetail.tsx:119) and defends against `undefined` everywhere else in that file (`summary?.summary`, `if (!summary) return`, `summary?.keyInsights ?? []`), but at the mount site it silences the compiler with a non-null assertion: `<ChatModal book={book} summary={summary!} .../>` (BookDetail.tsx:534). The Chat button that sets `showChat` is gated only on `!isPreview` (BookDetail.tsx:337-345) — NOT on a summary existing. So for any unsummarised book (every Goodreads-imported book, and any book whose summarisation failed) clicking Chat mounts ChatModal with `summary === undefined`. ChatModal.tsx:37 then calls `createBookChatSession(book, summary)`, which evaluates `chatSystemInstruction(book, summary)` inside its own try block (chat.ts:12-19); that template dereferences `summary.oneSentenceTakeaway`, `summary.summary` and `summary.keyInsights.join('\n- ')` (prompts.ts:61-67). The resulting TypeError is caught by `createBookChatSession` and rethrown as an AI error, out of a `useEffect` body — an uncaught throw during render/commit, which unwinds to the app's error boundary. The user gets a full-app crash screen from clicking a button. Correct shape: declare `summary: Summary | undefined` (as DailyWisdomModal.tsx:8 already does) and render the modal only when a summary exists, or gate the button. Blast radius: one mount site, but it is the whole-app error boundary, and the same prop lie is repeated in QuizModal (L12-F02).

```
9 | interface ChatModalProps {
 10 |   book: Book;
 11 |   summary: Summary;              // <- lies: caller has Summary | undefined
 12 |   onClose: () => void;
 13 | }
 ...
 36 |   useEffect(() => {
 37 |     chatSession.current = createBookChatSession(book, summary);   // TypeError when undefined
 38 |   }, [book, summary]);

// caller (outside lot, for context):
// BookDetail.tsx:119  summary: Summary | undefined;
// BookDetail.tsx:534  {showChat && <ChatModal book={book} summary={summary!} onClose={...} />}
```

**Verification (confirmed).** The prop lie is real and at the cited line: `summary: Summary;` at src/components/ChatModal.tsx:11, inside ChatModalProps (lines 9-13). The only mount site is src/components/BookDetail.tsx:534, which holds `Summary | undefined` (BookDetail.tsx:119) and defends against undefined everywhere else in that file (line 158 `if (!summary) return`, 183 same, 452 `summary ? ... : ''`, 461 `summary?.summary ?? 'No summary yet.'`, 470 `(summary?.keyInsights ?? [])`, 490 `(summary?.actionableSteps ?? [])`) yet silences the compiler with `summary!` at the one place it matters. Crash chain re-verified: ChatModal.tsx:36-38 -> chat.ts:11-19 -> prompts.ts:61 `${summary.oneSentenceTakeaway}` -> TypeError -> caught at chat.ts:17 -> rethrown as AiError from a useEffect body -> react-router's RenderErrorBoundary (node_modules/react-router/dist/development/lib/hooks.js:645-673, a real React class error boundary) -> src/app/ErrorBoundary.tsx full-app crash screen. The description's cited correct in-house pattern also checks out: src/components/DailyWisdomModal.tsx:8 really does declare `summary: Summary | undefined`. NOTE FOR THE REPORT: this is the callee-side view of the same single defect as F002 (BookDetail.tsx:534). They survived dedup because they are in different files, and both are legitimate fix sites, but they should be grouped as one cluster in the report so the Critical count is not read as two independent bugs. Applying F002's gate makes ChatModal.tsx:11 honest without editing this file.

**Reachability.** Same concrete path as F002: GoodreadsImport.tsx:97 -> useLibrary.tsx:150-160 (books created with no summaryId) -> click the book -> /book/:id -> BookDetailPage.tsx:42 passes summary=undefined -> BookDetail.tsx:337 renders Chat unconditionally -> click -> ChatModal mounts with summary=undefined -> app crash screen. Requires a Gemini key to be set: without one, getClient() (client.ts:9-11) throws MissingKeyError first and the effect still throws, so the app still crashes — just with the key-missing message rather than the generic one.

**Blast radius.** 1 mount site (BookDetail.tsx:534). The identical prop lie is repeated in QuizModal.tsx:23, whose failure is contained by QuizModal's own try/catch.

</details>

**Recommended fix.** Keep the chat window's requirement, because it genuinely cannot work without a summary, and fix the caller so chat is simply not offered until one exists.

*Feasibility: achievable*


#### F004 — A restored backup file is trusted completely and written straight into your library

**Critical** · `boundary-without-validation` · `src/components/ProfileView.tsx`:117 · discovery (L11) · confidence: high

**What it is.** When you restore a backup, the app reads whatever file you picked and treats its contents as a valid library. The only thing it checks is that a list of books is present at all.

**Why it matters.** A truncated, hand-edited, or older backup writes broken records permanently into your library, including the large embedded file data that broke the original version of this app. There is no undo and no repair screen.

<details><summary>Technical detail</summary>

`JSON.parse(content) as LibraryExport` takes an arbitrary user-chosen file off disk and asserts it into the app's most privileged type. The ONLY runtime check is `Array.isArray(data.books)` on line 119. Never checked: `data.version` (declared as the literal `2`, so a v1 or foreign file is silently claimed to be v2), `data.summaries`, and the shape of every element inside both arrays. The asserted value goes straight to persistence - `onImportLibrary(data)` (line 132) is `useLibrary.tsx:102`, which does `bookRepo.create({ ...book, profileId })` for each element (line 111) and `summaryRepo.upsert(summary)` for each summary (line 115). `src/lib/storage` performs ZERO runtime validation, so whatever shape got through is now a DURABLE record: it survives reload forever and nothing re-validates on read. CONCRETE FAILURE: import a file `{"books":[{"id":"x"}],"summaries":[{}]}`. The `Array.isArray` check passes. Book `x` is persisted with no `title`, `author`, `category`, `status`, `rating`, `coverImageUrl`, `readingTimeMinutes` or `hasPdf` - every one of which `types.ts` declares required. Then `summaryRepo.upsert({})` hits the `summaries` store, whose `keyPath` is `'id'` (db.ts:31); the record has no `id`, so IndexedDB throws `DataError` and the import promise rejects AFTER the books were already written. The user sees only the generic 'Could not read that backup file.' toast while the library is left half-imported and corrupt. Downstream, `BookCard` renders `undefined` fields, `Math.round(book.rating)` yields `NaN`, and `StatsView` buckets by an `undefined` category. BLAST RADIUS: every consumer of the `books` and `summaries` stores for the lifetime of the profile; the only recovery is the Danger Zone 'Reset All'. FIX SHAPE: parse to `unknown`, validate with a schema or hand-written guards (check `version === 2` and every required field of `Book`/`Summary`) before the first write, and make the import transactional so a bad element aborts rather than half-applies.

```
116:        const content = e.target?.result as string;
117:        const data = JSON.parse(content) as LibraryExport;
118:
119:        if (!Array.isArray(data.books)) {
120:          toast.error('That is not a BookSum backup file.');
121:          setImportStatus('error');
122:          return;
123:        }
...
132:        const added = await onImportLibrary(data);
```

**Verification (confirmed).** Confirmed at the cited line and materially stronger than the discoverer realised. src/components/ProfileView.tsx:117 is `const data = JSON.parse(content) as LibraryExport;`, sourced from an arbitrary user-chosen file via FileReader (lines 113-116, `e.target?.result as string` — itself a second unchecked assertion). The only runtime check is `Array.isArray(data.books)` at line 119. `data.version` is never read anywhere in src/ despite being declared as the literal `2` (types.ts:99). The asserted value goes straight to durable storage: ProfileView.tsx:132 -> useLibrary.tsx:102-122, which does `bookRepo.create({ ...book, profileId })` per element (line 111) and `summaryRepo.upsert(summary)` per element (line 115). repo.ts:51-61 and 116-119 add no validation — `books.create` only fills in `id` and `addedAt`. db.ts:30 confirms the summaries store is `keyPath: 'id'` with no autoIncrement, so the discoverer's `summaryRepo.upsert({})` scenario really does throw DataError, and because the books loop (useLibrary.tsx:109-113) runs entirely BEFORE the summaries loop (114-116), the library is left half-written exactly as described, with only the generic 'Could not read that backup file.' toast (ProfileView.tsx:136-140). The `reload()` at line 118 never runs, so the corruption is invisible until the next page load.

**Reachability.** Concretely reachable with a file that genuinely exists in the wild, which is stronger than the hand-crafted example in the description. The untouched original app (commit 670b5fe) shipped an export button that wrote `{ version: 1, timestamp, profile, books }` (670b5fe:components/ProfileView.tsx:55-70) where each book is a v1 `BookInsight` (670b5fe:types.ts:19-36) carrying `summary`, `keyInsights`, `actionableSteps`, `detailedSummary`, and — critically — `pdfData` and `audioData` as inline base64. Import that v1 file today: `Array.isArray(data.books)` passes, `data.version === 1` is never checked, `data.summaries` is undefined (survives via `payload.summaries ?? []` at useLibrary.tsx:114), and every v1 book is spread whole into `bookRepo.create`. Result: the `books` store is durably populated with base64 PDF and audio bytes on Book records — a direct violation of the CLAUDE.md invariant 'No binary data in records ... This is what broke the original app' — plus `hasPdf: undefined` (so the PDF button at BookDetail.tsx:402 never renders for data that IS there) and every summary silently stranded on the Book with no Summary record, so BookDetail.tsx:461 shows 'No summary yet.' forever. User path: Profile -> Import backup -> pick an old booksum-backup-*.json -> confirm.

**Blast radius.** 1 assertion (ProfileView.tsx:117), 1 consumer (useLibrary.tsx:102). Data blast radius is unbounded: both the `books` and `summaries` IndexedDB stores for the lifetime of the profile, with no re-validation on read anywhere in repo.ts and no recovery short of the Danger Zone reset.

</details>

**Recommended fix.** Treat the file as untrusted, check every record field by field before the first write, and refuse the whole restore if anything does not match.

*Feasibility: achievable*


#### RT-F001 — Opening chat without an API key replaces the entire app with an error screen

**Critical** · `untyped-public-function` · `src/lib/ai/chat.ts`:11 · red team (lying-types) · confidence: high

**What it is.** Starting a chat is the only AI action in the app that fails immediately rather than in the background. When no Gemini key has been entered, it fails, and the screen that opened it does not catch the failure.

**Why it matters.** This is the default state of every fresh install. Clicking Chat on any book wipes out the whole interface — navigation, library, everything — instead of opening the key dialog. It directly breaks the project's stated promise that the app works without a key.

<details><summary>Technical detail</summary>

`createBookChatSession(book, summary): Chat` declares that it always yields a Chat. It cannot: `getClient()` (src/lib/ai/client.ts:11) throws `MissingKeyError` whenever `localStorage` holds no Gemini key, and the catch block re-throws it as an AiError. This is the ONLY synchronous AI entry point in the codebase — every other one (`summarizeBook`, `generateBookQuiz`, `generateAudioSummary`, `sendMessageStream`) is `async`, so its throw becomes a rejection that the caller's try/catch absorbs. Here the throw is synchronous and the sole consumer, ChatModal.tsx:36-38, invokes it inside a `useEffect` with no try/catch. Exact input: a user with no API key (the default for every fresh install) opens any book and clicks the 'Chat' button (BookDetail.tsx:340 sets showChat with no key gate). Broken consumer: the throw escapes the effect, react-router's route `errorElement` (routes.tsx:16) catches it, and the ENTIRE app — nav, library, everything — is replaced by 'Something went wrong'. This directly violates the documented project invariant 'The app works with no key... Only AI actions gate, and they open the key dialog': instead of opening ApiKeyDialog, the app bricks itself. No test covers this path.

```
src/lib/ai/chat.ts
 11: export function createBookChatSession(book: Book, summary: Summary): Chat {
 12:   try {
 13:     return getClient().chats.create({
 16:   } catch (error) {
 17:     throw toAiError(error);   // MissingKeyError passes straight through
 18:   }

src/components/ChatModal.tsx
 36:   useEffect(() => {
 37:     chatSession.current = createBookChatSession(book, summary);   // no try/catch
 38:   }, [book, summary]);
```

</details>

**Recommended fix.** Make the routine report a missing key rather than failing outright, and have the chat window route that through the existing handler, which already opens the key dialog.


#### RT-F002 — A damaged leftover record from the old app hangs the loading screen forever

**Critical** · `untyped-public-function` · `src/lib/storage/migrate.ts`:80 · red team (lying-types) · confidence: high

**What it is.** The one-time upgrade from the previous version is declared to always finish successfully. It has at least four ways to fail on data it does not control, and the screen that runs it never handles failure.

**Why it matters.** The loading spinner never clears, on this launch and on every reload afterwards. Worse, the marker that says the upgrade is done is written last, so each retry re-imports whatever it managed to copy, duplicating the library a little more each time.

<details><summary>Technical detail</summary>

`migrateLegacyData(): Promise<MigrationResult>` claims it always resolves to a result object. It has at least four reachable rejection paths, all over data the app does not control: (a) `readJson<T>(key): T | null` (line 54-62) is a bare `JSON.parse(raw) as T` with zero shape validation, so if `booksum_library_<id>` holds a JSON object instead of an array, `for (const legacy of legacyBooks)` at line 101 throws `TypeError: ... is not iterable` (verified in node); (b) `base64ToBytes(legacy.pdfData)` at line 136 throws `DOMException: Invalid character` on any malformed base64 (verified in node) — and legacy records are exactly the multi-megabyte base64 PDFs that CLAUDE.md says 'broke the original app', so truncated/quota-clipped values are likely; (c) the same at line 142 for `audioData`; (d) `blobs.put` / `books.create` reject with QuotaExceededError when those same PDFs are re-written into IndexedDB. Broken consumer: ProfileContext.tsx:30-42 runs `void (async () => { await migrateLegacyData(); ... setIsLoading(false); })()` with no `.catch`. A rejection skips `setIsLoading(false)` entirely, so `App.tsx:12` renders the full-screen spinner forever — and `main.tsx` has no top-level error boundary, so nothing else fires either. Worse, `localStorage.setItem(MIGRATION_MARKER, ...)` on line 149 is only reached on success, so every reload re-runs the migration from scratch: `profiles.create()` mints a NEW uuid each time, leaving a duplicate profile plus a partial book set per attempt. Silent data duplication behind a permanent spinner.

```
54: function readJson<T>(key: string): T | null {
 58:     return JSON.parse(raw) as T;          // no shape check; T is a fiction
 99:     const legacyBooks = readJson<LegacyBook[]>(`${LIBRARY_KEY_PREFIX}${userId}`) ?? [];
101:     for (const legacy of legacyBooks) {   // TypeError if the JSON was not an array
136:         const bytes = base64ToBytes(legacy.pdfData);   // DOMException on bad base64
149:   localStorage.setItem(MIGRATION_MARKER, new Date().toISOString());   // never reached on throw

src/features/profile/ProfileContext.tsx
 30:     void (async () => {
 31:       await migrateLegacyData();
 41:       setIsLoading(false);      // skipped on rejection -> spinner forever
 42:     })();
```

</details>

**Recommended fix.** Make failure part of the result, handle each book individually so one bad record is skipped rather than fatal, and write the completion marker even on a partial upgrade.


### 2.2 High

#### F008 — The linter's strongest safety rules never run because one configuration line is missing

**High** · `tsconfig-strictness-gap` · `eslint.config.js`:9 · discovery (L01) · confidence: high

**What it is.** The project's linter is configured in a way that leaves out its entire type-aware rule set. Those are precisely the rules that flag unchecked external data being treated as trusted.

**Why it matters.** The single most valuable automated defence against the problems in this report is installed but inert, so nothing prevents new instances of the same pattern from being added.

<details><summary>Technical detail</summary>

`eslint.config.js` spreads `tseslint.configs.recommended` and never sets `languageOptions.parserOptions.project` or `projectService`. Verified empirically with `npx eslint --print-config src/lib/storage/repo.ts`: 97 rules resolve, `parserOptions` is `{}`, and every type-checked rule is unset — `no-unsafe-assignment`, `no-unsafe-member-access`, `no-unsafe-call`, `no-unsafe-return`, `no-unsafe-argument`, `no-unnecessary-type-assertion`, `await-thenable`, `no-floating-promises`, `no-misused-promises`, `restrict-template-expressions`. These rules cannot fire at all without type information, so switching to `recommendedTypeChecked` alone would be a no-op; the parser must be given the project first.

Why it matters here specifically: this is the tier that polices the `any` produced by untyped runtime data, and this app has at least four such ingress points where `JSON.parse`/`response.json()` output is cast straight to a domain type (`src/lib/ai/summarize.ts:52` and `:73` `as RawBookResponse`, `src/lib/storage/migrate.ts:58` `as T`, `src/components/ProfileView.tsx:117` `as LibraryExport`, `src/lib/covers/googleBooks.ts:12` `as {items?:...}`). `no-unsafe-assignment`/`no-unsafe-argument` are exactly the rules that flag those, and today nothing does. `no-unnecessary-type-assertion` would also tell the team which of the 10 `as` casts in the codebase are already redundant.

Correct behaviour: set `parserOptions.projectService: true` (plus `tsconfigRootDir`) and layer `tseslint.configs.recommendedTypeChecked` over the current recommended set, with a `disableTypeChecked` override for plain-JS config files. Note the honest cost: enabling the type-checked tier will surface new errors that must be triaged before CI goes green again, and it materially slows `eslint .`.

Note in fairness to the current config: `@typescript-eslint/no-explicit-any` (error) and `@typescript-eslint/ban-ts-comment` (error) ARE active via the recommended set, and the codebase has zero `any` annotations and zero `@ts-ignore`/`@ts-expect-error`/`eslint-disable` comments. The gap is the type-aware tier only.

```
eslint.config.js
  6  export default tseslint.config(
  7    { ignores: ['dist', 'node_modules', 'coverage'] },
  8    js.configs.recommended,
  9    ...tseslint.configs.recommended,          // <-- non-type-aware tier only
 10    {
 11      files: ['**/*.{ts,tsx}'],
 12      languageOptions: {
 13        ecmaVersion: 2022,
 14        globals: { ...globals.browser },       // <-- no parserOptions.project/projectService

$ npx eslint --print-config src/lib/storage/repo.ts
  total rules resolved: 97
  @typescript-eslint/no-explicit-any                 [2]
  @typescript-eslint/ban-ts-comment                  [2]
  @typescript-eslint/no-unsafe-assignment            -- NOT SET --
  @typescript-eslint/no-unnecessary-type-assertion   -- NOT SET --
  @typescript-eslint/no-floating-promises            -- NOT SET --
  parserOptions: {}
  has project/projectService: false
```

**Verification (confirmed).** Confirmed at the cited line and independently reproduced. eslint.config.js:9 is `...tseslint.configs.recommended,` and the `languageOptions` block at lines 12-15 sets only `ecmaVersion` and `globals` — there is no `parserOptions.project` or `projectService` anywhere in the file (37 lines total, read in full). I re-ran the discoverer's empirical check and got identical numbers: `npx eslint --print-config src/lib/storage/repo.ts` resolves 97 rules with `parserOptions: {}`; `@typescript-eslint/no-explicit-any` and `ban-ts-comment` are both [2]; `no-unsafe-assignment`, `no-unsafe-argument`, `no-unsafe-member-access`, `no-unnecessary-type-assertion`, `no-floating-promises` and `restrict-template-expressions` are all NOT SET. The four ingress points the description names are all real and all sit exactly where `no-unsafe-assignment`/`no-unsafe-argument` would fire: summarize.ts:52 and :73 (`as RawBookResponse`), migrate.ts:58 (`as T`), ProfileView.tsx:117 (`as LibraryExport`), googleBooks.ts:12. The fairness note also holds — the repo really does have zero `any` and zero ts-comment suppressions, which is the baseline for this audit. The claim that `recommendedTypeChecked` alone would be a no-op without the parser wiring is correct: those rules require type information and are skipped entirely without a program.

**Reachability.** Not a runtime path — this is the missing detector, not a defect. Its significance is that it is the tier that would have caught F004, F005 and F007 statically before they shipped.

**Blast radius.** Repo-wide. Every .ts/.tsx file is linted with 97 rules and ~10 type-checked rules inert, including the four unvalidated-boundary casts this audit found independently.

</details>

**Recommended fix.** Point the linter at the TypeScript project configuration and enable the type-checked rule set, then work through whatever it reports.

*Feasibility: requires-design*


#### F009 — A restricted API key is reported as a content-safety block, so the key dialog never opens

**High** · `discriminated-union-opportunity` · `src/app/AppShell.tsx`:49 · discovery (L08) · confidence: high

**What it is.** The app sorts AI failures into categories and offers to fix the key for only two of them. A key rejected because of its own domain restrictions is filed under the wrong category.

**Why it matters.** A user who has sensibly locked down their Gemini key sees a message about safety filters and is given no route to the only screen where the key can be changed. Every AI feature stays broken with no way out.

<details><summary>Technical detail</summary>

`handleAiError` narrows the 8-member `AiErrorKind` discriminated union (src/lib/ai/errors.ts:1-9) with a two-arm `if` and no exhaustiveness guard. Two failures follow.

(1) LIVE DEFECT — the consumer side of the errors.ts misclassification. Google's Generative Language API rejects a referrer-restricted key with HTTP 403 and a body containing 'Requests from referer <...> are blocked'. `toAiError` tests `lower.includes('blocked')` at src/lib/ai/errors.ts:54 BEFORE it reads the status at line 59, so `kind` is set to `'safety'`, never `'invalid-key'`. The classification happens deep in `src/lib/ai/client.ts:26` (`throw toAiError(error)`); AppShell:48 re-calls `toAiError`, which short-circuits at errors.ts:46 (`if (error instanceof AiError) return error`) and hands back the already-wrong kind. The `if` at line 49 is therefore false, `setShowKeyDialog(true)` at line 53 never runs, and the user is told 'Gemini blocked this request under its safety filters' with no path to fix their key.

(2) STRUCTURAL — an `if` over two of eight union members compiles even if the union grows. Adding a ninth kind (e.g. `'expired-key'`, `'referrer-blocked'`) silently falls through with no compiler complaint. A `switch` on `aiError.kind` with an `assertNever(kind)` default would make every future kind a compile error at this exact line.

BLAST RADIUS: total for key recovery. `setShowKeyDialog(true)` at AppShell:53 is the ONLY place in `src/` that opens the key dialog, and AppShell:204 is the only mount of `<ApiKeyDialog>` (verified by grep across src/). Three consumers route into it: `AddBookModal` via the `onAiError` prop (AppShell:196 -> AddBookModal.tsx:83), and `LibraryPage.tsx:80` and `LibraryPage.tsx:98` via `useShell()`. Every other `toAiError` consumer (BookDetail.tsx:169/189, ChatModal.tsx:72, EReader.tsx:213, QuizModal.tsx:65) only toasts `.message` and cannot open the dialog at all. This breaks the CLAUDE.md invariant 'Only AI actions gate, and they open the key dialog.'

```
47:  const handleAiError = useCallback((error: unknown): string => {
48:    const aiError = toAiError(error);
49:    if (aiError.kind === 'missing-key' || aiError.kind === 'invalid-key') {
50:      // Close whatever asked for the key first: two aria-modal dialogs on screen
51:      // means two competing focus traps.
52:      setShowAddBook(false);
53:      setShowKeyDialog(true);
54:    }
55:    return aiError.message;
56:  }, []);
```

**Verification (confirmed).** Both halves confirmed, and I found extra evidence that makes the live-defect half stronger than stated. STRUCTURAL half: src/app/AppShell.tsx:47-56 is verbatim as quoted — a two-arm `if` over `aiError.kind` narrowing an 8-member union (errors.ts:1-9) with no exhaustiveness guard, so a ninth kind falls through silently. LIVE-DEFECT half: errors.ts:53-61 orders `lower.includes('quota')`, then `lower.includes('safety') || lower.includes('blocked')`, and only reaches `statusOf(error)` in the trailing `else` (lines 57-61) — so any message containing 'blocked' preempts the 403 check. I verified the message really does contain it: @google/genai's `throwErrorIfNotOK` (node_modules/@google/genai/dist/vertex_internal/index.js:2941-2967) sets `errorMessage = JSON.stringify(errorBody)` and throws `new ApiError({ message: errorMessage, status })`, i.e. the ENTIRE 403 JSON body lands in `.message`. Google's referrer-restriction body is `{"error":{"code":403,"message":"Requests from referer <...> are blocked.","status":"PERMISSION_DENIED"}}` — 'blocked' is in there, so kind becomes 'safety' and never 'invalid-key'. The strongest corroboration is the repo's own test: errors.test.ts:17 asserts `403 -> 'invalid-key'`, proving that is the intended mapping, while errors.test.ts:29-31 only ever exercises a message containing BOTH 'blocked' and 'SAFETY' — so the collision case is exactly the one the suite does not cover. AppShell:48's re-call of toAiError does short-circuit at errors.ts:46 (`if (error instanceof AiError) return error`) on the already-misclassified error from client.ts, as described. BLAST RADIUS verified by grep across src/: `setShowKeyDialog(true)` appears only at AppShell.tsx:53 and `<ApiKeyDialog>` is mounted only at AppShell.tsx:204; the three consumers are AddBookModal.tsx:83 (via the onAiError prop wired at AppShell.tsx:196), LibraryPage.tsx:80 and LibraryPage.tsx:98 (via useShell()); every other toAiError consumer (BookDetail.tsx:169/189, ChatModal.tsx:72, EReader.tsx:213, QuizModal.tsx:65) only toasts `.message`. One clarification for the report: the minimal fix is in errors.ts:53-61, not at the cited AppShell line — the AppShell change is the structural hardening.

**Reachability.** Concrete for any user who restricts their key. Set an HTTP-referrer restriction on the Gemini key in Google Cloud Console (the obvious hardening for a key that lives in localStorage on a public GitHub Pages demo), then use any AI action — Add Book, or LibraryPage.tsx:80/:98's recommendation flows. Google returns 403 with 'are blocked.' in the body; client.ts:26 classifies it as 'safety'; AppShell.tsx:49 is false; the key dialog never opens; the user reads 'Gemini blocked this request under its safety filters' with no way to reach the only key-entry surface in the app. This breaks the CLAUDE.md invariant 'Only AI actions gate, and they open the key dialog.'

**Blast radius.** 1 narrowing site (AppShell.tsx:49), but it is the sole gateway to the app's only API-key dialog (AppShell.tsx:53 and :204 are the only occurrences in src/). 3 consumers route into it; 5 other toAiError call sites cannot open the dialog at all.

</details>

**Recommended fix.** Classify failures by the error's status code before guessing from its wording, and make the app handle every category explicitly so a new one cannot be silently ignored.

*Feasibility: achievable*


#### F011 — Library cards say 'Not summarised yet' for books that really do have a summary

**High** · `discriminated-union-opportunity` · `src/components/BookCard.tsx`:89 · discovery (L12) · confidence: high

**What it is.** A book records the single fact 'is this summarised?' in three separate places that are free to disagree, and the upgrade from the previous version fills in only some of them.

**Why it matters.** Every book carried over from the old app shows 'Not summarised yet' and '0 min read' in the library list, while its own detail page shows the real summary. The statistics screen undercounts reading time for the same reason.

<details><summary>Technical detail</summary>

`Book` encodes 'is this summarised?' three independent ways — `summaryId?` (types.ts:50), `oneSentenceTakeaway?` (types.ts:48) and the required `readingTimeMinutes: number` (types.ts:47) with a 0/5 sentinel — and nothing in the type ties them together, so producers can and do write inconsistent combinations. The live break is `migrateLegacyData`: its `books.create` call (migrate.ts:105-119) sets `summaryId` but omits `oneSentenceTakeaway`, even though it writes that takeaway onto the Summary at migrate.ts:125. Every book migrated from the original localStorage app therefore renders 'Not summarised yet' at BookCard.tsx:89 — on LibraryPage.tsx:191 and StatsView.tsx:119 — while BookDetail.tsx:452 displays the real takeaway. migrate.test.ts:96-105 checks `summaryId` but never the Book's takeaway copy, so nothing catches it. (The Goodreads-import-then-summarise path named in the original finding is NOT reachable: `saveSummary`'s backfill at useLibrary.tsx:82-83 is dead because its only caller, BookDetail.tsx:186, returns early when there is no summary at line 183.) Fix shape: a discriminated union on `Book` — `{ summarised: false } | { summarised: true; summaryId: string; oneSentenceTakeaway: string; readingTimeMinutes: number }` — so the denormalised fields cannot be written apart from the id; the immediate one-line fix is to add `oneSentenceTakeaway` to the migration's `books.create`.

```
88 |         <p className="... italic border-l-2 border-orange-100 pl-4">
 89 |           {book.oneSentenceTakeaway ? `"${book.oneSentenceTakeaway}"` : 'Not summarised yet'}
 90 |         </p>
 ...
 94 |             <Clock size={14} className="text-orange-500" />
 95 |             <span>{book.readingTimeMinutes} min read</span>   // renders "0 min read", no summarised check

// producers (outside lot, for context):
// useLibrary.tsx:157  readingTimeMinutes: 0,          <- Goodreads import placeholder
// useLibrary.tsx:82-83 if (book && book.summaryId !== summary.id) await bookRepo.update({ ...book, summaryId: summary.id });
```

**Verification (amended).** The DEFECT is real and reachable, but the discoverer's producer chain is wrong. Confirmed at source: BookCard.tsx:89 renders `book.oneSentenceTakeaway ? ... : 'Not summarised yet'` and line 95 prints `{book.readingTimeMinutes} min read` with no `summaryId` check; types.ts:47-50 declares the three unlinked fields (`readingTimeMinutes: number` required, `oneSentenceTakeaway?`, `summaryId?`). REFUTED SUB-CLAIM: the cited 'import from Goodreads, then generate a summary' path does not exist. `saveSummary` (useLibrary.tsx:78-88) is reachable only via BookDetailPage.tsx:44-47 -> BookDetail.tsx:186, which sits inside `handleMasterclassClick` behind `if (!summary) return` (BookDetail.tsx:183) — so the backfill branch at useLibrary.tsx:82-83 is effectively dead code, and no UI action attaches a Summary to an existing summary-less Book. THE REAL PRODUCER, which the discoverer missed: `migrateLegacyData` creates the Book with `summaryId` SET (migrate.ts:117) but omits `oneSentenceTakeaway` entirely from the `books.create` call (migrate.ts:105-119), while writing the takeaway onto the Summary at migrate.ts:125. So every legacy-migrated book is summarised yet renders 'Not summarised yet' on its card, while BookDetail.tsx:452 shows the real takeaway from the Summary — precisely the contradiction the finding describes. It is untested: migrate.test.ts:96-105 asserts `atomic?.summaryId` is truthy but never checks the Book's takeaway copy. Severity stays high.

**Reachability.** User of the original Google AI Studio build (commit 670b5fe) opens the new app. ProfileContext.tsx:31 runs migrateLegacyData on boot; every migrated book lands with summaryId but no oneSentenceTakeaway (migrate.ts:105-119). LibraryPage.tsx:191 and StatsView.tsx:119 then render BookCard.tsx:89 as 'Not summarised yet' for the entire migrated library, while /book/:id shows the summary.

**Blast radius.** BookCard has 2 render sites (LibraryPage.tsx:191, StatsView.tsx:119) = every list surface. The denormalised pair is also read at BookDetail.tsx:330 and summed into 'Total Learning' at StatsView.tsx:17. One producer is broken (migrate.ts); the other two (AddBookModal.tsx:72, LibraryPage.tsx:92) correctly set the takeaway.

</details>

**Recommended fix.** Write the short takeaway alongside the summary link everywhere a book is created, and tie the three fields together so they cannot drift apart.

*Feasibility: achievable*


#### F012 — Four controls on the book page are offered for books that have nothing to power them

**High** · `discriminated-union-opportunity` · `src/components/BookDetail.tsx`:337 · discovery (L11) · confidence: high

**What it is.** The book page decides what to show based on whether it is a preview, not on whether a summary exists. Four different fields are used to express 'summarised' and none of them is consulted here.

**Why it matters.** Users see chat, quiz, listen and export controls on unsummarised books. Two of them fail outright, one produces nothing, and a whole panel renders empty.

<details><summary>Technical detail</summary>

'Summarised' is expressed four separate ways that the type system does not tie together: `Book.summaryId?`, `Book.readingTimeMinutes` (required `number`, 0 when absent), `Book.oneSentenceTakeaway?`, and the separate `summary: Summary | undefined` prop. Because none of them narrows any of the others, `BookDetail` handles the unsummarised case ad hoc in five different places, and gets it wrong in all of them. (1) Lines 337-353: the Chat and Quiz buttons are gated only on `!isPreview`, never on `summary` - this is what makes L11-F01 reachable. (2) Lines 155-158: `handlePlayAudio` sets the spinner true, then `if (!summary) return` - the 'Quick Listen' button flashes a spinner and silently does nothing, with no message to the user. (3) Lines 181-183: `handleMasterclassClick` does the same - 'Read Full Summary' is a dead no-op on an unsummarised book. (4) Line 452: the 'The One Sentence Takeaway' heading and its styled card always render; when there is no summary the quote body is the empty string, so the user gets a large empty orange panel. (5) Line 330: `{book.readingTimeMinutes} mins` renders '0 mins' for every Goodreads-imported book, presented as fact next to the category. BLAST RADIUS: the entire BookDetail route for any unsummarised book, which after a Goodreads import is the whole library. FIX SHAPE: model the book as a tagged union - `{ summarised: false }` vs `{ summarised: true; summaryId: string; readingTimeMinutes: number; oneSentenceTakeaway: string; summary: Summary }` - so the three fields travel together and the compiler forces one explicit branch instead of five silent early returns. Requires touching the repo and every list view, so this is a design change, not a local fix.

```
155:  const handlePlayAudio = async (type: 'short' | 'long') => {
156:    try {
157:      setIsGeneratingAudio(true);
158:      if (!summary) return;
...
181:    setIsGeneratingDeepDive(true);
182:    try {
183:      if (!summary) return;
...
330:                    {book.readingTimeMinutes} mins
...
337:                {!isPreview && (
452:              {summary ? `"${summary.oneSentenceTakeaway}"` : ''}
```

**Verification (confirmed).** All five sub-claims verified against the current file. (1) BookDetail.tsx:337 `{!isPreview && (` wraps the Chat (339-345) and Quiz (346-352) buttons with no `summary` check; `isPreview` is never passed by the only mount site (BookDetailPage.tsx:40-53), so `!isPreview` is always true. (2) BookDetail.tsx:155-158: `setIsGeneratingAudio(true)` then `if (!summary) return`, with `finally { setIsGeneratingAudio(false) }` at 170-172 — the 'Quick Listen' spinner flashes and silently resets. (3) BookDetail.tsx:181-183: same shape for 'Read Full Summary' (`setIsGeneratingDeepDive(true)` then `if (!summary) return`, finally at 190-192) — a dead no-op, since the early-exit at 176 also requires a summary. (4) The takeaway `<section>` at 446-454 always renders; line 452 emits the empty string when there is no summary, leaving a large empty orange panel with its heading. (5) Line 330 prints `{book.readingTimeMinutes} mins` unconditionally, i.e. '0 mins' for every Goodreads-imported book (useLibrary.tsx:157). The prop type is honest — `summary: Summary | undefined` at line 119, fed from useBookRoute.ts:12,24 — the component just never branches on it. Severity high stands: this is the app's primary detail route (routes.tsx:19) and after a Goodreads import every book in the library is in this state.

**Reachability.** Import a Goodreads CSV (AddBookModal.tsx:122 -> GoodreadsImport), then click any imported book. useLibrary.tsx:150-160 created it with no summaryId, so useBookRoute.ts:21 resolves `summary` to undefined and BookDetailPage.tsx:42 passes undefined through. Every one of the five defects renders on that screen.

**Blast radius.** One mount site (BookDetailPage.tsx:40) but it is the whole /book/:id route; five separate ad-hoc handlings of the same unmodelled state inside one 540-line component. Four interactive controls (Chat, Quiz, Quick Listen, Read Full Summary) plus two display sections are affected.

</details>

**Recommended fix.** Gate those controls on the summary itself, and model 'summarised' as one fact rather than four independent fields.

*Feasibility: requires-design*


#### F014 — Editing your profile silently undoes a theme change made in the same visit

**High** · `branded-type-opportunity` · `src/components/ProfileView.tsx`:46 · discovery (L11) · confidence: high

**What it is.** The profile editor takes a snapshot of your profile when the page opens and writes that whole snapshot back when you save, even if something else changed your settings in the meantime.

**Why it matters.** Switch to dark mode and then save a bio edit, and the theme quietly reverts. The same silent clobbering applies to the chosen voice and the monthly reading goal.

<details><summary>Technical detail</summary>

Object-level branding case. `editedProfile` is seeded from the `profile` prop ONCE at mount (line 46, `useState(profile)`) and is never resynced - there is no `useEffect` on `profile`. Because the draft and the live record are both plain `Profile`, `onUpdate(editedProfile)` on line 73 typechecks perfectly even though the draft is a stale snapshot, and `onUpdate` is a WHOLE-RECORD write (`ProfilePage.tsx` wires it to `updateProfile`, which is `profileRepo.update(next)` - every field is overwritten). CONCRETE FAILURE, entirely within this one screen: `<ThemeToggle />` is rendered on line 371; clicking it calls `useTheme().setTheme`, which at `useTheme.ts:36` does `await updateProfile({ ...profile, theme: next })` - persisting the new theme and pushing a new `profile` prop into `ProfileView`. `editedProfile` still holds the OLD theme. The user then clicks 'Edit Profile', changes the bio, clicks 'Save Profile' -> `handleSave()` writes the stale snapshot -> the theme silently reverts to whatever it was when the page mounted. Same clobber applies to `favoriteVoice` and `monthlyGoal` if anything else writes the profile while the view is open. This is durable data loss, not a render glitch - the reverted value is what lands in IndexedDB. BLAST RADIUS: the profile record; every consumer of `profile.theme` (the whole app's dark mode). FIX SHAPE: either make the update API a patch (`(patch: Partial<Profile>) => void`, merged against the live record at the repo) so a stale draft cannot carry unrelated fields, or brand the draft as a distinct nominal type so the compiler forces an explicit merge with the current profile at the save site. VERIFIED NEGATIVE for the classic `as Profile` trap: the edit form uses correct spreads (`{ ...editedProfile, monthlyGoal: ... }` on 239, `bio` on 261, `favoriteVoice` on 279) and no cast - the persisted record does conform to `Profile`. The defect is staleness, not shape.

```
45:  const [isEditing, setIsEditing] = useState(false);
46:  const [editedProfile, setEditedProfile] = useState(profile);
...
72:  const handleSave = () => {
73:    onUpdate(editedProfile);
74:    setIsEditing(false);
75:  };
...
371:          <ThemeToggle />
```

**Verification (confirmed).** Confirmed end to end. ProfileView.tsx:46 `const [editedProfile, setEditedProfile] = useState(profile)` seeds the draft once; the file's React import at line 1 is `{ useState, useMemo, useRef }` — there is provably no `useEffect` anywhere in the component, so no resync, and `setEditedProfile` is called only by the three field editors (lines 239, 261, 279). `handleSave` at 72-75 writes the whole draft via `onUpdate(editedProfile)`. That is wired to a whole-record write: ProfilePage.tsx:33 `onUpdate={(next) => void updateProfile(next)}` -> ProfileContext.tsx:64-68 `profileRepo.update(next)` + `setProfile(next)` -> repo.ts:30-33 a blind `put`, every field overwritten. The theme clobber is entirely within this one screen: `<ThemeToggle />` renders at ProfileView.tsx:371 and useTheme.ts:33-39 persists `{ ...profile, theme: next }`, pushing a fresh `profile` prop that `editedProfile` never sees. ProfileView is not remounted on that update (same element type/position in ProfilePage.tsx:31-38), so the stale `useState` initial survives. Their 'VERIFIED NEGATIVE' also checks out — lines 239/261/279 use correct spreads and there is no `as Profile` cast, so the persisted record does conform to `Profile`; the defect is staleness, not shape. Severity high stands: durable, silently-persisted field loss on a two-click path. Category note: `branded-type-opportunity` is a stretch against the spec's primitive-focused definition, but the finding explicitly frames it as object-level branding and the proposed fix is nominal typing of the draft, so I have left it.

**Reachability.** Open /profile. Click the theme toggle (ProfileView.tsx:371) — useTheme.ts:36 persists the new theme. Click 'Edit Profile' (line 170), change the bio (line 261), click 'Save Profile' — handleSave (72-75) writes the mount-time snapshot and the theme silently reverts in IndexedDB. Same clobber for favoriteVoice and monthlyGoal if anything writes the profile while the view is open.

**Blast radius.** One component, but it owns the only editor for the profile record; the clobbered `theme` field drives dark mode app-wide via useTheme.ts:27-31 mounted in AppShell.tsx:31. `updateProfile` (ProfileContext.tsx:64) has 2 callers: ProfilePage.tsx:33 and useTheme.ts:36 — the two that race.

</details>

**Recommended fix.** When saving, merge only the fields the form actually edits into the current stored record instead of overwriting it with a stale copy.

*Feasibility: achievable*


#### F015 — The quiz window also demands a summary its caller cannot guarantee

**High** · `non-null-assertion` · `src/components/QuizModal.tsx`:23 · discovery (L12) · confidence: high

**What it is.** Like the chat window, the quiz window declares that a summary is always supplied, while the page that opens it frequently has none and overrides the compiler to make it fit.

**Why it matters.** On an unsummarised book the quiz opens, fails, and shows a generic 'AI error' message that blames the service. The real cause is invisible to the user and to whoever reads the error report.

<details><summary>Technical detail</summary>

Identical defect to L12-F01: `QuizModalProps.summary` is typed `Summary` (non-optional) while BookDetail holds `Summary | undefined` and asserts it away — `<QuizModal book={book} summary={summary!} .../>` (BookDetail.tsx:536). The Quiz button is gated only on `!isPreview` (BookDetail.tsx:346-347), not on a summary existing. With `summary === undefined`, `generateBookQuiz(book, summary)` (QuizModal.tsx:44) builds `quizPrompt(book, summary)` which dereferences `summary.summary` and `summary.keyInsights.join('\n')` (prompts.ts:48-49). Because that happens inside an async function wrapped in try/catch, the TypeError is swallowed by `generateBookQuiz`'s `throw toAiError(error)` (quiz.ts:18-20) and surfaces as `toast.error(toAiError(error).message)` — the user is told the AI service failed when the real cause is a programming error the type system was asked to ignore. Severity is High rather than Critical only because the throw is contained (no error-boundary crash) — but it is also silent-misdiagnosis territory: a support report of "the quiz says the AI is broken" will chase the wrong cause. Fix shape: `summary: Summary | undefined` plus an explicit not-summarised branch, or gate both buttons on `summary`.

```
21 | interface QuizModalProps {
 22 |   book: Book;
 23 |   summary: Summary;             // <- lies: caller has Summary | undefined
 24 |   onClose: () => void;
 25 | }
 ...
 43 |       try {
 44 |         const quizData = await generateBookQuiz(book, summary);   // prompts.ts:48 reads summary.summary
 ...
 63 |       } catch (error) {
 65 |         toast.error(toAiError(error).message);   // TypeError reported as an AI failure

// caller (outside lot): BookDetail.tsx:536  summary={summary!}
```

**Verification (confirmed).** Confirmed and traced end to end at current lines. QuizModal.tsx:21-25 declares `summary: Summary` (non-optional). The only caller is BookDetail.tsx:536 `<QuizModal book={book} summary={summary!} .../>` where the prop is `summary: Summary | undefined` (BookDetail.tsx:119, fed from useBookRoute.ts:12,24). The Quiz button (BookDetail.tsx:346-352) is gated only on `!isPreview` (line 337), and `isPreview` is never passed by the sole mount site (BookDetailPage.tsx:40-53). With `summary === undefined`: QuizModal.tsx:44 calls generateBookQuiz -> quiz.ts:12 evaluates `quizPrompt(book, summary)` inside the try block -> prompts.ts:48 `${summary.summary}` throws `TypeError: Cannot read properties of undefined (reading 'summary')` -> quiz.ts:19 `throw toAiError(error)` -> errors.ts:45-63 classifies it `unknown` (not a SyntaxError; a TypeError but the message lacks 'fetch'; no numeric `status`) -> MESSAGES.unknown -> QuizModal.tsx:65 `toast.error(...)` shows 'Something went wrong talking to Gemini. Try again.' A programming error is reported to the user as a Gemini failure, exactly as claimed. One precision point the finding omits: `getClient()` is evaluated before the argument object (quiz.ts:10), so with NO API key the user correctly gets MissingKeyError first — the misdiagnosis requires a valid key to be configured. Severity high stands: a component's public prop contract lies, and the `!` at the call site is what lets it compile.

**Reachability.** Configure a valid Gemini key, import a book via Goodreads (no summary), open /book/:id, click 'Quiz'. The modal mounts with `summary` undefined and shows the generic AI-failure toast plus 'Could not generate quiz.' (QuizModal.tsx:125-137).

**Blast radius.** One `!` site (BookDetail.tsx:536) plus the identical twin at line 534 for ChatModal (ChatModal.tsx:20, same pattern — tracked as the L12-F01 sibling). Two lying prop contracts; `generateBookQuiz` (quiz.ts:8) has exactly this one caller.

</details>

**Recommended fix.** Fix the caller so the quiz is not offered without a summary, which makes the override unnecessary at both sites.

*Feasibility: achievable*


#### F016 — Unchecked AI quiz output is written into the review queue before the user answers anything

**High** · `boundary-without-validation` · `src/components/QuizModal.tsx`:52 · discovery (L12) · confidence: high

**What it is.** As soon as a quiz loads, every question the AI returned is saved as a permanent review card, without first checking that each one is usable.

**Why it matters.** Closing the quiz immediately does not help; the cards are already stored. A bad batch poisons the spaced-repetition queue permanently, and the app offers no way to delete individual cards.

<details><summary>Technical detail</summary>

`generateBookQuiz` returns `QuizQuestion[]` obtained by asserting `JSON.parse(response.text || '{}') as { questions?: QuizQuestion[] }` (quiz.ts:16) with no runtime validation. QuizModal is the consumer that makes that fiction durable: in its load effect it writes every returned item straight to IndexedDB via `newCard({ options, correctAnswerIndex, ... })` (QuizModal.tsx:52-61 -> srs.ts:22-36 -> repo.ts:99-102), producing `ReviewCard` rows whose declared type promises `options: string[]` and a valid `correctAnswerIndex: number` (types.ts:88-89). The Gemini response schema enforces neither: `options` has no minItems/maxItems and `correctAnswerIndex` is `Type.NUMBER` (not INTEGER) with no minimum/maximum — the 'Array of 4 possible answers' and 'Index (0-3)' constraints exist only as prose `description` strings (schemas.ts:64-72). A model returning 3 options with index 3, a float index, `-1`, or a 1-based index produces a `ReviewCard` the type system swears is well-formed. Unlike the in-modal render, these rows survive the session: ReviewPage.tsx:76 and :94 then render a card that can never be answered correctly, and grading it 'Again' resets the interval to one day (srs.ts:46) so it re-surfaces indefinitely. Note the cards are written before the user answers anything, so closing the modal does not prevent the write. The only repair is deleting the book, which cascades to its cards (repo.ts:68-74, line 72); there is no way to fix a single card. Fix shape: validate at the `generateBookQuiz` boundary — drop questions failing `Number.isInteger(correctAnswerIndex) && correctAnswerIndex >= 0 && correctAnswerIndex < options.length` — before either rendering or persisting, and tighten the response schema. Blast radius: the whole review feature plus the `reviewCards` object store.

```
49 |         const seen = new Set((await reviewCards.listByBook(book.id)).map((c) => c.question));
 50 |         for (const question of quizData) {
 51 |           if (seen.has(question.question)) continue;
 52 |           await reviewCards.upsert(
 53 |             newCard({
 56 |               question: question.question,
 57 |               options: question.options,                       // unvalidated
 58 |               correctAnswerIndex: question.correctAnswerIndex, // unvalidated, unbounded
 59 |               explanation: question.explanation,
 60 |             }),
 61 |           );
 62 |         }
```

**Verification (amended).** Confirmed with one factual correction. VERIFIED: quiz.ts:16 `JSON.parse(response.text || '{}') as { questions?: QuizQuestion[] }` then `data.questions ?? []` at line 17 — no runtime validation of any kind. QuizModal.tsx:49-62 makes that fiction durable: `newCard({ options: question.options, correctAnswerIndex: question.correctAnswerIndex, ... })` (lines 57-58) -> srs.ts:22-36 copies both fields verbatim -> `reviewCards.upsert` (QuizModal.tsx:52) -> repo.ts:99-102 `db.put('reviewCards', card)`. types.ts:88-89 promises `options: string[]` and `correctAnswerIndex: number`. The Gemini schema enforces neither invariant: schemas.ts:64-72 gives `options` no minItems/maxItems and types `correctAnswerIndex` as `Type.NUMBER` (not INTEGER) with no minimum/maximum — 'Array of 4 possible answers' (line 67) and 'Index (0-3)' (line 71) live only in prose `description` fields. Consumers ReviewPage.tsx:76 and :94 then compare against that index, so a bad card is permanently unanswerable and the user grading it 'Again' resets its interval to 1 day (srs.ts:46), re-surfacing it indefinitely. CORRECTION: 'There is no repair path short of clearing the store' is false — repo.ts:68-74 `books.remove` cascades to `reviewCards.removeByBook(id)` at line 72, and ProfilePage.tsx:24 removes every book in bulk. The user still cannot fix one poisoned card without deleting the whole book, so the finding stands; only that sentence is wrong. Severity high stands: unvalidated model output crossing into durable IndexedDB storage under a type that claims validation is precisely the spec's highest-priority category.

**Reachability.** Open any summarised book, click 'Quiz'. Every returned question is written to the reviewCards store before the user answers anything (QuizModal.tsx:50-62 runs in the load effect, not on submit) — so a malformed question is persisted even if the user closes the modal immediately. It then appears on /review forever.

**Blast radius.** The whole review feature plus the `reviewCards` object store. `generateBookQuiz` has 1 caller (QuizModal.tsx:44) but its unvalidated output reaches 2 consumers (QuizModal.tsx:78/183 transient, ReviewPage.tsx:76/94 durable) and 5 repo entry points (repo.ts:78-108). Every row written by QuizModal.tsx:52 is permanent until its book is deleted.

</details>

**Recommended fix.** Validate the questions once where they are produced, so both the quiz screen and the review queue are protected by the same single check.

*Feasibility: achievable · Independently re-discovered by the red team as RT-F206*


#### F019 — The CSV import accepts any file you pick, with no size, type, or header check

**High** · `boundary-without-validation` · `src/features/library/GoodreadsImport.tsx`:24 · discovery (L09) · confidence: high

**What it is.** The import reads whatever bytes the file chooser hands over and turns them into text no matter what they were. Nothing confirms the file is a spreadsheet export, nothing limits its size, and nothing checks the column headings.

**Why it matters.** Picking the wrong file, or a spreadsheet from a different service, quietly produces a library full of placeholder authors and statuses instead of an error. A very large file can lock the browser tab while it is parsed.

<details><summary>Technical detail</summary>

`await file.text()` returns a `string` for ANY bytes the user picks and never throws on invalid UTF-8 (the decoder substitutes U+FFFD), so the entire `File -> string -> GoodreadsParseResult` chain is typed end-to-end with zero runtime validation. `file.type` and `file.size` are never consulted; the `accept=".csv,text/csv"` attribute on line 66 is advisory only (every OS picker lets the user switch to 'All Files'). The parser does no header validation either: `columnOf('title')` (src/lib/goodreads.ts:83-98) returns -1 for a non-Goodreads file and `cell(-1)` yields ''. Two distinct failure modes result, and BOTH are reachable: (a) file has no `title` column (a PDF renamed .csv, a semicolon-delimited European CSV) -> every row is skipped, `{rows: [], skipped: N}`, and the user correctly sees the 'No books found' toast on line 28 -- benign; (b) file HAS a `title` column but is not a Goodreads export (a Calibre export uses `title,authors,...` -- `author` singular does not match) -> EVERY row imports as a real book with `author: 'Unknown'` (goodreads.ts:109), `status: 'Want to Read'` (toStatus('')), `rating: 0`, `category: 'Other'` (useLibrary.tsx:154). The preview panel on lines 84-91 reports this as '4000 books found, 0 finished, 4000 to read, 0 rows skipped' -- indistinguishable from a successful parse -- and clicking Import writes 4000 junk records into IndexedDB with no undo short of deleting each one or wiping the whole profile. There is also no `file.size` cap: `file.text()` materialises the whole file as one JS string and `parseCsv` walks it char-by-char, so a several-hundred-MB pick freezes the tab (the try/catch only catches the OOM after the fact). Correct behaviour: gate on the header row (require `title` plus at least one of `author` / `exclusive shelf`) and report 'this does not look like a Goodreads export' instead of a book count, and reject on `file.size` before reading. Blast radius: the app's only bulk-ingress path; every imported record is persistent and flows into LibraryPage, StatsView, ProfileView and the review queue.

```
19  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
20    const file = event.target.files?.[0];
21    if (!file) return;
22
23    try {
24      const parsed = parseGoodreadsCsv(await file.text());
25      setPreview(parsed);
26      setFilename(file.name);
27      if (parsed.rows.length === 0) {
28        toast.error('No books found in that file. Is it a Goodreads CSV export?');
```

**Verification (confirmed).** Confirmed, and both failure modes reproduced by execution. VERIFIED at current lines: GoodreadsImport.tsx:19-33 `handleFile` reads `await file.text()` at line 24 and feeds it straight to `parseGoodreadsCsv`; `file.type` and `file.size` are never read anywhere in the file (only `file.name` at line 26); `accept=".csv,text/csv"` at line 66 is advisory only; the preview at 84-91 reports a book count with no shape check; the Import button at 95-103 gates only on `preview.rows.length`. MODE (a) — junk bytes: `parseGoodreadsCsv('%PDF-1.7\nsome binary-ish\nmore lines\n')` returned `{rows: [], skipped: 2}`, so the user correctly sees the 'No books found' toast at line 28. Benign, as claimed. MODE (b) — foreign-but-title-bearing CSV: a StoryGraph/Calibre-shaped header returned 2 rows, every one `author: 'Unknown'`, `status: 'Want to Read'`, `rating: 0`, `skipped: 0` — indistinguishable from a successful parse in the preview panel. useLibrary.tsx:150-160 then persists each with `category: 'Other'` and `readingTimeMinutes: 0`, with no undo short of deleting each book (repo.ts:68-74) or ProfilePage's Reset All (ProfilePage.tsx:15-28). The no-size-cap claim also holds: nothing reads `file.size`, `file.text()` materialises the whole file, and goodreads.ts:28-58 walks it char-by-char. Severity high stands — this is the app's only bulk-ingress path and the spec ranks boundary-without-validation as the highest-priority category.

**Reachability.** Add Book -> Goodreads tab (AddBookModal.tsx:115-123) -> pick any file. StoryGraph exports use `Title,Authors,...` and Calibre uses `title,authors,...`; neither has an `author` or `exclusive shelf` column, so both land mode (b): the preview reports 'N books found, 0 finished, N to read' and Import writes N junk records into IndexedDB.

**Blast radius.** The app's only bulk-ingress path. One handler (GoodreadsImport.tsx:19-33) feeding `parseGoodreadsCsv` (goodreads.ts:78-118) and `importGoodreadsRows` (useLibrary.tsx:128-168), whose output flows to LibraryPage.tsx:191, StatsView.tsx:17,119, ProfileView.tsx:51-70 and the /book/:id route. Every written record is persistent.

</details>

**Recommended fix.** Check the file size and the header row before anything is saved, and report a clear failure when the headings are not recognised.

*Feasibility: achievable*


#### F022 — The library restore routine declares its input is already a valid backup, and it is not

**High** · `boundary-without-validation` · `src/features/library/useLibrary.tsx`:102 · discovery (L09) · confidence: high

**What it is.** The function that writes a restored backup into the database states that it receives a fully-formed library. Its only caller obtains that value by assuming an arbitrary file is one.

**Why it matters.** Every element of the file is written to storage unchecked, so a bad backup durably corrupts books and summaries. Because the promise is made in the type, no reviewer or tool flags the gap.

<details><summary>Technical detail</summary>

`importLibrary` accepts `payload: LibraryExport` -- a type that is fiction at this boundary. The only producer is src/components/ProfileView.tsx:117, `const data = JSON.parse(content) as LibraryExport`, whose sole guard is `Array.isArray(data.books)` (ProfileView.tsx:119); individual elements are never checked. The `?? []` on lines 109 and 114 is the author acknowledging the declared type is not trustworthy, but the loop body then spreads each unvalidated element straight into `bookRepo.create({ ...book, profileId })`, and `books.create` (src/lib/storage/repo.ts:51-61) fills in only `id` and `addedAt` -- every other field passes through verbatim into IndexedDB. Concrete failure: a hand-edited or truncated backup containing `{"version":2,"books":[{"id":"a"}],"summaries":[]}` passes `Array.isArray`, the confirm dialog says 'Found 1 book', and a `Book` record with no `title` is persisted. Navigating to `/` then runs LibraryPage.tsx:50 `book.title.toLowerCase()` -> `TypeError: Cannot read properties of undefined (reading 'toLowerCase')` inside the `filteredBooks` useMemo, which throws on every render of the default route. The corruption survives reload because it is in IndexedDB, so the app's home page is permanently broken until the user clears storage. Correct behaviour: validate each element against the `Book`/`Summary` shape (a hand-written guard or Zod) at this boundary and drop or report the bad rows; the declared parameter type should be `unknown` until validated. Blast radius: one caller today (ProfilePage -> ProfileView), but it writes to the store that all six `useLibrary` consumers read.

```
102  const importLibrary = useCallback(
103    async (payload: LibraryExport): Promise<number> => {
104      if (!profile) return 0;
105
106      const existing = new Set((await bookRepo.listByProfile(profile.id)).map((b) => b.id));
107      let added = 0;
108
109      for (const book of payload.books ?? []) {
110        if (existing.has(book.id)) continue;
111        await bookRepo.create({ ...book, profileId: profile.id });
```

**Verification (confirmed).** Every cited line verified verbatim. useLibrary.tsx:102-103 `const importLibrary = useCallback(async (payload: LibraryExport): Promise<number> => {`; the `?? []` escape hatches at lines 109 and 114; the unchecked spread at line 111 `await bookRepo.create({ ...book, profileId: profile.id });`. Producer verified: src/components/ProfileView.tsx:116-117 `const content = e.target?.result as string; const data = JSON.parse(content) as LibraryExport;` with its sole guard at line 119 `if (!Array.isArray(data.books))`, the confirm text at line 127 quoting `data.books.length`, and the handoff at line 132 `await onImportLibrary(data)`. Persistence verified: repo.ts:51-61 `books.create` builds `{ ...input, id: input.id ?? newId(), addedAt: input.addedAt ?? new Date().toISOString() }` and calls `put('books', book)` — every other field passes through byte-for-byte, no validation anywhere in the chain. Crash site verified: LibraryPage.tsx:50 `book.title.toLowerCase().includes(...)` inside the `filteredBooks` useMemo (lines 44-63), which runs on every render of the index route (routes.tsx:18). Corruption is in IndexedDB so it survives reload; the render throw is caught by the parent route's errorElement (routes.tsx:16 `<ErrorBoundary />`), so the user gets a permanent error screen at `/` rather than a white page — but the home route stays broken until storage is cleared. NOTE: this is the consumer half of F004 (filed critical at ProfileView.tsx:117); both should be fixed by ONE validator, not two. High is the right severity for this half — the parameter type is the lie and the hook is where the write happens.

**Reachability.** Profile page -> 'Import' file input (ProfileView.tsx:109 `handleImport`) -> select any .json whose top level has a `books` array. A truncated or hand-edited backup, or any unrelated JSON with a `books` key, passes `Array.isArray(data.books)` at ProfileView.tsx:119 and every element is persisted.

**Blast radius.** 1 caller today (ProfilePage.tsx:37 -> ProfileView.tsx:132), but it writes into the `books` store that all 5 `books`-reading consumers of useLibrary render from (AppShell.tsx:27, LibraryPage.tsx:18, ProfilePage.tsx:9, StatsPage.tsx:6, useBookRoute.ts:10).

</details>

**Recommended fix.** Change the routine to accept untrusted input and do the validation there, so one check protects both the restore screen and the storage layer.

*Feasibility: achievable · Independently re-discovered by the red team as RT-F003*


#### RT-F102 — The startup sequence assumes the one-time upgrade can never fail

**High** · `boundary-without-validation` · `src/features/profile/ProfileContext.tsx`:31 · red team (boundary-erasure) · confidence: high

**What it is.** The screen that sets up your profile runs the upgrade from the old version and waits for it without any failure handling. Clearing the loading state is the very last thing it does.

**Why it matters.** Any failure in the upgrade leaves the app stuck on the loading spinner with no error, no retry, and no way to reach any other screen. This is the blast radius of the unchecked leftover-data problem, in a file no discovery lot covered.

<details><summary>Technical detail</summary>

F007 covers the cast (`JSON.parse(raw) as T` at migrate.ts:58). This is its blast radius, in a file no lot covered. ProfileProvider's mount effect awaits `migrateLegacyData()` inside a `void (async () => ...)()` with no try/catch, and `setIsLoading(false)` is the last statement. If the migration rejects, `isLoading` stays `true` forever, `App.tsx:12` renders the spinner, no router ever mounts, and there is no in-app recovery — the user must manually clear site data. Reachable throws all originate at the erased boundary: `readJson<LegacyBook[]>` returns whatever was under `booksum_library_*`, and if that is an object rather than an array, `for (const legacy of legacyBooks)` at migrate.ts:101 throws TypeError (verified: 'is not iterable'); `base64ToBytes(legacy.pdfData)` calls `atob`, which throws DOMException on non-base64 (verified); and an IndexedDB quota or blocked error rejects too. The migration is also completely untested against malformed input — all 8 cases in migrate.test.ts seed well-formed JSON.

```
27	  useEffect(() => {
 28	    let cancelled = false;
 29	
 30	    void (async () => {
 31	      await migrateLegacyData();
 32	      const list = await profileRepo.list();
 33	      if (cancelled) return;
 ...
 41	      setIsLoading(false);
 42	    })();
```

</details>

**Recommended fix.** Handle failure at the startup call, clear the loading state regardless, and surface the problem to the user instead of hanging.

*Effort: moderate*


#### F024 — A single review card with no answer options permanently jams the whole review session

**High** · `boundary-without-validation` · `src/features/review/ReviewPage.tsx`:93 · discovery (L10) · confidence: high

**What it is.** A review card is allowed to have an empty list of answer choices. When one reaches the review screen, no buttons render, so nothing can be selected and the session cannot advance.

**Why it matters.** The queue is ordered by due date and always returns the same stuck card first, so every card behind it becomes unreachable — on this reload and every future one. The app has no way to delete a single card.

<details><summary>Technical detail</summary>

`ReviewCard.options` is typed `string[]` (src/types.ts:88), which admits `[]`. Nothing between the model and this render validates it: `quiz.ts:16` casts unvalidated model JSON to `QuizQuestion[]`, `QUIZ_SCHEMA` (src/lib/ai/schemas.ts:64-72) expresses '4 options' and 'index 0-3' only in prose `description` strings that Gemini is free to ignore (no `minItems`, no bound), `QuizModal.tsx:52-61` persists every returned question verbatim, and `repo.reviewCards.listDue` re-types raw IndexedDB rows as `ReviewCard[]` with no runtime check. The compiler therefore certifies a non-empty choice list that the runtime cannot guarantee.

The concrete outcome is worse than a blank render. `options.map` at line 93 emits zero option buttons. `selected` is the ONLY state that can flip `isAnswered` (line 75), and it is set exclusively by an option button's onClick (line 99). The grade buttons — the only thing that calls `grade()` and the only thing that advances the queue (`useReviewQueue.ts:39` `setQueue(rest => rest.slice(1))`) — are rendered behind `{isAnswered && ...}` at line 125. So a card with no options renders a question with no answers and no grading controls, and the session cannot advance past it. There is no skip control. Reloading does not help: `listDue` sorts by `dueAt` ascending, so the same card returns to the head of the queue. Every other due card behind it becomes permanently unreachable and the Review feature is bricked for that profile until the user deletes the book (which is the only path that removes its cards).

Correct behavior: validate card shape at the queue boundary (non-empty `options`) and either drop or repair malformed cards, and/or make the render defensive so a card with no answerable options can still be graded/skipped. Blast radius: `useReviewQueue` -> `ReviewPage` is the whole Review feature; one malformed card from one quiz generation disables it entirely. Corroboration that the type permits this: the project's own fixture at `src/features/review/reviewQueue.test.tsx:149` constructs `newCard({ options: [], correctAnswerIndex: 0 })` and it type-checks cleanly — but that test only exercises deletion, so no test renders this state.

```
75:   const isAnswered = selected !== null;
 92:         <div className="space-y-3">
 93:           {current.options.map((option, index) => {
 99:                 onClick={() => !isAnswered && setSelected(index)}
114:           })}
115:         </div>
125:       {isAnswered && (
134:                 onClick={() => void grade(value)}
```

**Verification (confirmed).** Deadlock reproduced structurally; every link in the chain verified at its current line. types.ts:88 `options: string[]` admits []. quiz.ts:16 `JSON.parse(response.text || '{}') as { questions?: QuizQuestion[] }` then `return data.questions ?? []` at line 17 — no shape check. schemas.ts:64-68: the QUIZ_SCHEMA `options` property is `{ type: Type.ARRAY, items: { type: Type.STRING }, description: 'Array of 4 possible answers.' }` — the count lives only in prose, there is no minItems; the index bound at schemas.ts:69-72 is likewise prose-only. QuizModal.tsx:50-62 loops the returned questions and calls `reviewCards.upsert(newCard({... options: question.options ...}))` at line 57 with no filter; srs.ts:28 `options: input.options` copies it through; repo.ts:99-102 `upsert` puts it straight in IndexedDB; repo.ts:78-90 `listDue` re-types raw rows as ReviewCard[] with no guard and sorts `dueAt` ASCENDING at line 89. Render deadlock verified in ReviewPage.tsx: line 75 `const isAnswered = selected !== null;`; line 93 `current.options.map(...)` produces the option buttons; line 99 `onClick={() => !isAnswered && setSelected(index)}` is the ONLY setSelected call other than the reset at line 41; the grade buttons are behind `{isAnswered && (` at line 125 and `grade(value)` at line 134; the queue only advances at useReviewQueue.ts:39 `setQueue((rest) => rest.slice(1))` inside `grade`. With `options: []`, zero buttons render, `selected` stays null, the block at 125-145 never mounts, `grade` is unreachable, and listDue returns the same card at the head after every reload. I searched ReviewPage.tsx end to end: there is no skip/next control. Removal path confirmed to be book deletion only: repo.ts:72 `reviewCards.removeByBook(id)` inside `books.remove`. Root cause is shared with F005 (critical, quiz.ts:16); F024 is the distinct render-side consequence and stands on its own.

**Reachability.** Take a quiz on any book (QuizModal) -> Gemini returns one question with an empty `options` array (the schema does not forbid it) -> that card is persisted -> next visit to /review renders the question with no answer buttons and no grade buttons, and every card behind it is unreachable until the book is deleted.

**Blast radius.** The whole Review feature: useReviewQueue.ts -> ReviewPage.tsx, plus the persist path QuizModal.tsx:52-61 -> repo.ts:99. One malformed card from one quiz generation disables review for that profile.

</details>

**Recommended fix.** Skip cards with no usable options when the queue is built, which also rescues cards that were already saved in that state.

*Feasibility: achievable*


#### F072 — The correct-answer position is never compared against the number of options, so a card can be unwinnable

**High** · `boundary-without-validation` · `src/features/review/ReviewPage.tsx`:76 · discovery (L10) · confidence: high

**What it is.** The review screen compares the user's choice against a stored answer position that nothing has confirmed points at a real option.

**Why it matters.** A card with an out-of-range answer can never be marked correct. There is no crash and no warning, so the card silently recurs forever and the user's review statistics quietly degrade.

<details><summary>Technical detail</summary>

`ReviewCard.correctAnswerIndex` is a bare `number` (src/types.ts:89) with no bound relating it to `options.length`, and it arrives from the same unvalidated path as F01 (model JSON cast at `quiz.ts:16`, persisted by `QuizModal.tsx:58`, re-typed from IndexedDB by `repo.reviewCards.listDue`). The schema's '0-3' constraint is a prose `description` (src/lib/ai/schemas.ts:71), not an enforced range. Nothing in `useReviewQueue` or `ReviewPage` checks `0 <= correctAnswerIndex < options.length`.

Worth being precise about the failure mode: `ReviewPage` never does `options[correctAnswerIndex]`, so there is no `undefined` render and no crash. It compares indices (lines 76 and 94). With an out-of-range index (say 7 against 4 options, or a negative), `showCorrect` is false for every rendered option and `isCorrect` is false for every possible selection. The user answers, no option is highlighted green, whatever they picked is highlighted red, and the explanation claims a correct answer that is not on screen. The card is permanently un-answerable-correctly and stays in rotation being marked wrong forever. Because the user can still grade it, this degrades quietly rather than blocking — which is why it is likely to go unnoticed and unreported.

Correct behavior: validate the index against the options array at the boundary where cards enter typed code, and model the pair as a single validated unit rather than two independent primitives. Blast radius: every card produced by quiz generation; the identical unguarded comparison also exists in `QuizModal.tsx:78` and `:183`, so the same malformed data misbehaves in the in-quiz flow too.

```
75:   const isAnswered = selected !== null;
 76:   const isCorrect = selected === current.correctAnswerIndex;
 ...
 93:           {current.options.map((option, index) => {
 94:             const showCorrect = isAnswered && index === current.correctAnswerIndex;
 95:             const showWrong = isAnswered && index === selected && !isCorrect;
```

**Verification (amended).** Confirmed and under-graded. types.ts:89 declares `correctAnswerIndex: number` with nothing relating it to `options.length`; schemas.ts:69-72 declares it as a bare `Type.NUMBER` whose '0-3' constraint lives only in a `description` string, while genai.d.ts exposes `minimum?` (:12073) and `maximum?` (:12065) unused; the `options` array's '4 answers' constraint at schemas.ts:64-68 is likewise description-only. ReviewPage.tsx:76 and :94 compare indices with no bounds check, and the finding is precise about the consequence: ReviewPage never does `options[correctAnswerIndex]`, so there is no crash - instead `showCorrect` is false for every option and `isCorrect` is false for every possible selection, so the card is permanently unanswerable-correctly, the explanation at :120 describes an answer not on screen, and the card stays in rotation being graded wrong forever. Amending UP to high: this is a known-runtime-data ingress (Gemini JSON -> IndexedDB -> typed code) with no validation at any layer, which the spec's high band names explicitly, and the specific corruption is a well-known model behaviour (1-based indices - returning 4 for a 4-option array is off-by-one and silently out of range). Silent, permanent, and it degrades rather than blocks, so it will not get reported by users.

**Reachability.** Generate a quiz on any book -> QuizModal persists the model's questions as review cards -> a card whose correctAnswerIndex is >= options.length or negative can never be answered correctly, on both ReviewPage.tsx:76/94 and the in-quiz comparisons at QuizModal.tsx:78/183.

**Blast radius.** Every card produced by quiz generation; 2 consumer files (ReviewPage, QuizModal), 4 comparison sites; persisted in IndexedDB so bad cards survive reload.

</details>

**Recommended fix.** Validate the answer position where the AI's output is first turned into stored data, so the bad card never reaches the queue.

*Feasibility: achievable · Severity amended from medium → high during verification*


#### F029 — AI failures are categorised by searching the error text, so two common failures are misfiled

**High** · `boundary-without-validation` · `src/lib/ai/errors.ts`:53 · discovery (L04) · confidence: high

**What it is.** The app decides what kind of AI failure occurred by looking for words inside the error message, and it does that before consulting the reliable status code the service actually returns.

**Why it matters.** A key blocked by domain restrictions is reported as a content-safety block, so the key dialog never opens. Rate limiting is reported as an exhausted quota, so the user is told to wait a day when a few seconds would do.

<details><summary>Technical detail</summary>

`@google/genai` builds every HTTP error as `new ApiError({ message: JSON.stringify(errorBody), status })` (node_modules/@google/genai/dist/web/index.mjs:14249-14255, and the streaming variant at :13969 which prefixes `got status: N.` to the same stringified JSON). So `error.message` is not a human sentence — it is Google's entire error document verbatim, including `error.status`, `error.details[].@type`, `reason` codes and quota metadata. `toAiError` lowercases that whole document and picks the `AiErrorKind` tag by substring, running the message checks (lines 53-54) BEFORE the status checks (lines 58-61), so the substring always wins over the one field the SDK actually types (`ApiError.status: number`). Two concrete misclassifications follow, both on the primary onboarding path for a browser-based bring-your-own-key app:

(a) A key with an HTTP-referrer restriction returns 403 with `"message": "Requests from referer <origin> are blocked."` and `"reason": "API_KEY_HTTP_REFERRER_BLOCKED"`. `lower.includes('blocked')` matches at line 54, so kind becomes `safety` and the 403 -> `invalid-key` mapping at line 59 never runs. The user is told "Gemini blocked this request under its safety filters. Try a different book or wording." and — because `src/app/AppShell.tsx:49` only opens the key dialog for `missing-key`/`invalid-key` — is given no route to the key settings at all. It is a dead end with actively misleading advice. Worse, the `safety` kind is otherwise near-unreachable: the SDK does not throw for a genuine content block (it populates `promptFeedback.blockReason` on a 200; `src/lib/ai/summarize.ts:52,73` then parses `response.text || '{}'`), and a grep of `src/**` finds exactly one non-SDK throw in the AI layer (`src/lib/ai/tts.ts:28`, message 'No audio generated'). So in practice the `safety` branch fires for key-restriction errors and not for safety blocks.

(b) Google's 429 `RESOURCE_EXHAUSTED` body names the quota that was exceeded (`quotaMetric`, `quotaId`, and "quota" in the message text), so line 53 matches and kind becomes `quota` — "Your Gemini quota is used up. Check your usage in Google AI Studio." — for what is usually a transient per-minute rate limit that clears in seconds. The `status === 429 -> 'rate-limited'` branch at line 60 is therefore dead for real SDK errors. The unit test that appears to cover it (`src/lib/ai/errors.test.ts:18`) passes only because its fixture message is the literal `'boom'`; the fixture at errors.test.ts:4-6 models `ApiError`'s shape but not its message content, so it proves a mapping that production never reaches, and errors.test.ts:26 enshrines the substring precedence as intentional.

Blast radius: `toAiError` is the single normalisation funnel for everything the AI layer throws — 16 direct call sites (9 in src/lib/ai: client.ts:26, chat.ts:18, chat.ts:37, quiz.ts:19, recommend.ts:41, summarize.ts:56, summarize.ts:77, summarize.ts:101, tts.ts:32; 7 in UI: AppShell.tsx:48, ChatModal.tsx:72, BookDetail.tsx:169, BookDetail.tsx:189, EReader.tsx:213, QuizModal.tsx:65, ApiKeyDialog.tsx:33), plus 3 more routed through `handleAiError` via ShellContext (LibraryPage.tsx:80, LibraryPage.tsx:98, AddBookModal.tsx:83). Correct shape: narrow on the SDK's own exported, typed `ApiError` (`node_modules/@google/genai/dist/genai.d.ts:479-483` declares `class ApiError extends Error { status: number }`) and parse the message back into the documented `{ error: { code, message, status, details } }` shape behind a type guard, then discriminate on the machine-readable `error.status` enum plus the presence of a `google.rpc.RetryInfo` detail. Keep substring matching only as the last-resort fallback, and move the status check ahead of it so the one typed field wins.

```
src/lib/ai/errors.ts
 51   let kind: AiErrorKind = 'unknown';
 52 
 53   if (lower.includes('quota')) kind = 'quota';
 54   else if (lower.includes('safety') || lower.includes('blocked')) kind = 'safety';
 55   else if (error instanceof SyntaxError) kind = 'malformed';
 56   else if (error instanceof TypeError && lower.includes('fetch')) kind = 'network';
 57   else {
 58     const status = statusOf(error);
 59     if (status === 400 || status === 401 || status === 403) kind = 'invalid-key';
 60     else if (status === 429) kind = 'rate-limited';
 61   }

node_modules/@google/genai/dist/web/index.mjs (what `message` actually contains)
14249         const errorMessage = JSON.stringify(errorBody);
14251             const apiError = new ApiError({ message: errorMessage, status: status });
```

**Verification (confirmed).** Confirmed on every repo-verifiable claim, including the vendored SDK citations. errors.ts:51-61 is verbatim as quoted: `kind = 'unknown'` at 51, `lower.includes('quota')` at 53, `lower.includes('safety') || lower.includes('blocked')` at 54, SyntaxError at 55, TypeError+'fetch' at 56, and the status switch only inside the trailing `else` at 57-61 (400/401/403 -> invalid-key at 59, 429 -> rate-limited at 60). SDK VERIFIED: node_modules/@google/genai/dist/web/index.mjs:14249 `const errorMessage = JSON.stringify(errorBody);` -> :14251-14254 `const apiError = new ApiError({ message: errorMessage, status: status });`, with errorBody built at :14241-14248 as `{ error: { message, code, status } }`; the streaming variant at :13969-13974 builds `` `got status: ${status}. ${JSON.stringify(chunkJson)}` `` and throws ApiError with `status: code`. So `error.message` really is Google's whole error document, and errors.ts:49 lowercases it and substring-matches it BEFORE ever reading the one field the SDK types. node_modules/@google/genai/dist/genai.d.ts:479-483 confirmed: `export declare class ApiError extends Error { /** HTTP status code */ status: number; constructor(options: ApiErrorInfo); }` — the typed alternative the finding recommends exists and is exported. DEAD-END CLAIM VERIFIED: AppShell.tsx:47-56 `handleAiError` opens the key dialog only for `kind === 'missing-key' || kind === 'invalid-key'` (line 49), so a 403 tagged 'safety' gives the user errors.ts:33's 'Gemini blocked this request under its safety filters. Try a different book or wording.' with no route to Settings. SAFETY-BRANCH-NEAR-UNREACHABLE CLAIM VERIFIED: summarize.ts:52 and :73 parse `response.text || '{}'` rather than inspecting promptFeedback, so a genuine content block returns a 200 and never throws; and `grep -rn 'throw ' src/` excluding `throw new` plus inspection shows the AI layer's only non-SDK throw is tts.ts:28 `throw new Error('No audio generated')`. So the 'safety' branch fires for key-restriction errors and not for safety blocks — as claimed. 16 direct call sites confirmed by grep, matching the enumerated list exactly, plus the 3 handleAiError routes (LibraryPage.tsx:80, LibraryPage.tsx:98, AddBookModal via AppShell.tsx:196). The only element I could not verify from the repo is Google's exact referrer-rejection wording (external knowledge), but the mechanism does not depend on it: any 4xx body containing 'blocked' or 'quota' anywhere — field names and nested `details` included — wins over the typed status. High is correct: this is the single normalisation funnel for the app's entire AI surface, on the primary onboarding path for a bring-your-own-key app.

**Reachability.** Paste a Gemini key that carries an HTTP-referrer or API restriction (the default when a key is created with restrictions in Google Cloud) -> any AI action -> the SDK throws ApiError with the JSON body as its message -> errors.ts:54 matches 'blocked' -> kind 'safety' -> AppShell.tsx:49 does not open the key dialog -> the user is told to reword their book request and has no path to fix the key. Separately, any 429 whose body names the exceeded quota is tagged 'quota' ('used up, check Google AI Studio') rather than 'rate-limited', so errors.ts:60 is dead for real SDK errors.

**Blast radius.** 16 direct toAiError call sites (verified by grep: client.ts:26, chat.ts:18, chat.ts:37, quiz.ts:19, recommend.ts:41, summarize.ts:56/77/101, tts.ts:32, AppShell.tsx:48, ChatModal.tsx:72, BookDetail.tsx:169/189, EReader.tsx:213, QuizModal.tsx:65, ApiKeyDialog.tsx:33) plus 3 via handleAiError. Every AI error message and every key-dialog trigger in the app flows through these 11 lines.

</details>

**Recommended fix.** Read the status code first and treat the message text only as a fallback for cases the status cannot distinguish.

*Feasibility: achievable*


#### F005 — Quiz questions from the AI are accepted without any checking, then stored permanently

**High** · `boundary-without-validation` · `src/lib/ai/quiz.ts`:16 · discovery (L05) · confidence: high

**What it is.** Whatever the AI returns for a quiz is assumed to be a complete, well-formed set of questions. Nothing verifies that the question text, the answer choices, or the correct answer are actually present.

**Why it matters.** A malformed reply becomes permanent review cards in your spaced-repetition queue, where they can never be answered correctly and cannot be deleted from inside the app.

<details><summary>Technical detail</summary>

src/lib/ai/quiz.ts:16 asserts non-deterministic model output straight into the strict domain type: `JSON.parse(response.text || '{}') as { questions?: QuizQuestion[] }`. QuizQuestion (types.ts:105-110) declares all four fields required, so after the cast the compiler swears every element is complete; nothing checks that at runtime, and the `?? []` on line 17 covers only a missing `questions` key, not a non-array value or a missing field on an element. The same file's sibling, schemas.ts:85-97, deliberately models the book response with an all-optional `RawBookResponse` mirror precisely because 'a model can always omit one, schema or not' — that discipline was not applied here. Mitigating (and why this is High rather than Critical): quiz.ts:13 passes `responseSchema: QUIZ_SCHEMA`, and QUIZ_SCHEMA (schemas.ts:55-83) marks all four item fields plus `questions` as required, so Gemini's constrained decoding makes a conforming response near-certain and truncation degrades to a handled SyntaxError. The damage if it ever does slip through is disproportionate: QuizModal.tsx:50-61 writes each parsed element into the durable `reviewCards` store via srs.ts:22-36 and repo.ts:99-102 with no validation, ReviewPage.tsx:93 does `current.options.map(...)` on the earliest-due card, and repo.ts:77-109 exposes no per-card delete and no re-validation on read — so a single bad card breaks /review permanently and the only escape is deleting the whole book.

```
13 |      config: { responseMimeType: 'application/json', responseSchema: QUIZ_SCHEMA },
  14 |    });
  15 |
  16 |    const data = JSON.parse(response.text || '{}') as { questions?: QuizQuestion[] };
  17 |    return data.questions ?? [];
  18 |  } catch (error) {
  19 |    throw toAiError(error);

// src/features/review/ReviewPage.tsx:93 — the consumer that crashes
  93 |          {current.options.map((option, index) => {
```

**Verification (amended).** The pattern, the persistence path and the no-recovery argument are all confirmed; the severity is one notch too high because the discoverer missed an upstream guard. CONFIRMED: src/lib/ai/quiz.ts:16 is `const data = JSON.parse(response.text || '{}') as { questions?: QuizQuestion[] };` with `return data.questions ?? [];` at 17 — a pure assertion, no element check, and `?? []` does not prove `questions` is an array. QuizQuestion (types.ts:105-110) declares all four fields required. QuizModal.tsx:44-62 iterates the result and writes each element straight through srs.ts:22-36 `newCard` (which copies `options`/`correctAnswerIndex` verbatim, no defaults) into `reviewCards.upsert` (repo.ts:99-102). ReviewPage.tsx:93 `current.options.map(...)` is the consumer that would throw. repo.ts:77-109 confirms the recovery claim exactly: `listByProfile`, `listDue`, `listByBook`, `upsert`, `removeByBook` — there is NO per-card delete and no re-validation on read, so one bad card poisons /review until the whole book is deleted. The RawBookResponse contrast (schemas.ts:85-97) is real and its own comment — 'Every field is optional because a model can always omit one, schema or not' — is the codebase arguing the discoverer's case. MISSED GUARD: quiz.ts:13 passes `responseSchema: QUIZ_SCHEMA` with `responseMimeType: 'application/json'`, and QUIZ_SCHEMA (schemas.ts:55-83) declares `required: ['question','options','correctAnswerIndex','explanation']` on each item plus `required: ['questions']` at the top. Gemini enforces that by constrained decoding, so a structurally-conforming response is near-certain; the realistic non-conforming case is truncation, which yields invalid JSON -> SyntaxError -> errors.ts:55 kind 'malformed' -> already handled by quiz.ts:19. That makes the crash real but not a routinely-exercised production path, which is what Critical requires. Everything else stands, so: Critical -> High.

**Reachability.** Requires the model to violate its own constrained-decoding schema — possible (schema enforcement is not a formal guarantee, and the repo's own comment at schemas.ts:86 says so) but not a path a user can deliberately walk. If it does happen: click Quiz on any summarised book -> QuizModal.tsx:44 -> a malformed card is persisted at line 52 -> from then on, every visit to /review (routes.tsx:21) crashes at ReviewPage.tsx:93 with `Cannot read properties of undefined (reading 'map')` into the root errorElement, permanently, because repo.ts exposes no per-card delete.

**Blast radius.** 1 direct call site (QuizModal.tsx:44). Once written, the corrupt record fans out to every reviewCards consumer: ReviewPage.tsx:93, useReviewQueue, and the review counts in stats.

</details>

**Recommended fix.** Check each question as it arrives and discard the ones that do not fit, using the same validate-and-drop approach already used for book summaries.

*Feasibility: achievable · Severity amended from critical → high during verification · Independently re-discovered by the red team as RT-F004*


#### F030 — Book recommendations are trusted to be complete, and one missing title loses all six

**High** · `boundary-without-validation` · `src/lib/ai/recommend.ts`:30 · discovery (L05) · confidence: high

**What it is.** The recommendation list returned by the AI is assumed to have a title, author and description on every entry. Nothing checks that before the entries are used.

**Why it matters.** A single entry missing its title makes the cover lookup fail, and the failure discards the whole batch, so the user sees no recommendations at all rather than five good ones.

<details><summary>Technical detail</summary>

`as { recommendations?: Omit<Recommendation, 'coverUrl'>[] }` asserts that every element has non-optional `title`, `author` and `description` (declared at recommend.ts:9-14). Nothing validates that. `?? []` on line 35 guards only a null/undefined `recommendations` key, not a non-array value and not element shape. Two concrete failures. (1) A model that omits `title` on one recommendation: `fetchCover(rec.title, rec.author)` receives `undefined`. src/lib/covers/index.ts:13-20 swallows lookup errors, but its final line 21 `return placeholderCover(title)` is OUTSIDE the try, and placeholder.ts:5 calls `title.trim()` → `TypeError: Cannot read properties of undefined (reading 'trim')`. Because the map is wrapped in `Promise.all`, one bad element rejects the whole batch, the catch on line 40 converts it via `toAiError` into the generic 'Something went wrong talking to Gemini' (errors.ts:36 — a `TypeError` whose message lacks 'fetch' falls through to `'unknown'`), and all six recommendations are lost with a misleading message. (2) `recommendations` returned as an object rather than an array: `.map is not a function`, same misleading error. Even when nothing throws, an `undefined` field is spread into the `Recommendation` and cached — LibraryPage.tsx:74-77 writes the array to `localStorage`, and LibraryPage.tsx:35 re-asserts it back as `Recommendation[]` on the next load with no validation, so the bad shape survives reloads. Correct behavior: define an all-optional `RawRecommendationResponse` mirror (matching the existing `RawBookResponse` pattern in schemas.ts:87) and filter out elements missing a title/author before calling `fetchCover`. Blast radius: 1 call site (LibraryPage.tsx:71), whose output reaches localStorage and RecommendationCarousel.

```
30 |    const data = JSON.parse(response.text || '{}') as {
  31 |      recommendations?: Omit<Recommendation, 'coverUrl'>[];
  32 |    };
  33 |
  34 |    return Promise.all(
  35 |      (data.recommendations ?? []).map(async (rec) => ({
  36 |        ...rec,
  37 |        coverUrl: await fetchCover(rec.title, rec.author),
  38 |      })),
  39 |    );
```

**Verification (confirmed).** Confirmed with one mechanical correction that does not change the outcome. recommend.ts:30-39 is verbatim as quoted, including the assertion `as { recommendations?: Omit<Recommendation, 'coverUrl'>[] }` at 30-32, the `?? []` at 35 and `coverUrl: await fetchCover(rec.title, rec.author)` at 37. `Recommendation` at recommend.ts:9-14 declares `title`, `author`, `description` and `coverUrl` all non-optional, so `Omit<..., 'coverUrl'>` really does assert three required strings on unvalidated model output. Crash path VERIFIED: src/lib/covers/index.ts:12-22 — the try/catch spans only lines 14-19 inside the `for` loop; the final `return placeholderCover(title);` at line 21 is OUTSIDE it, and src/lib/covers/placeholder.ts:2-5 does `title.trim()` on line 5, so `fetchCover(undefined, ...)` throws `TypeError: Cannot read properties of undefined (reading 'trim')` after both lookups have been swallowed. Because the map is inside `Promise.all` (line 34), one bad element rejects the whole batch and all six results are lost. CORRECTION to the mechanism: the rejection does NOT pass through recommend.ts:40-41's catch. `return Promise.all(...)` inside a try in an async function does not route the rejection to the catch — the try completes normally and the function's promise adopts the rejected one. I reproduced this in node: the caller receives the RAW TypeError, not an AiError. The user-visible outcome is unchanged, because LibraryPage.tsx:71 awaits it and LibraryPage.tsx:80 calls `handleAiError(error)` -> AppShell.tsx:48 `toAiError` -> a TypeError whose message lacks 'fetch' falls through errors.ts:56 to `unknown` -> errors.ts:36 'Something went wrong talking to Gemini. Try again.' Same misleading message, one hop later. Persistence claim VERIFIED: LibraryPage.tsx:74-77 writes the array to localStorage and LibraryPage.tsx:35 re-asserts it as `{ at: number; items: Recommendation[] }` on the next load with no validation, so a bad shape survives reloads. Blast radius VERIFIED by grep: `getAIRecommendations` has exactly 1 call site (LibraryPage.tsx:71); the `Recommendation` type reaches RecommendationCarousel.tsx:7/11/15 and recommendationDefaults.ts:7. High is right — this is unvalidated Gemini ingress that both crashes a user-visible feature and poisons a cache.

**Reachability.** Library page -> the recommendation carousel's refresh control (LibraryPage.tsx:223 -> refreshRecommendations at :67) -> Gemini omits `title` on any one of the returned recommendations -> `fetchCover(undefined, ...)` throws inside Promise.all -> all recommendations are dropped and the user sees 'Something went wrong talking to Gemini.' The non-array variant ('.map is not a function') has the same path.

**Blast radius.** 1 call site (LibraryPage.tsx:71), whose output is written to localStorage (LibraryPage.tsx:74-77), re-asserted on load (LibraryPage.tsx:35) and rendered by RecommendationCarousel (props typed at RecommendationCarousel.tsx:7-15).

</details>

**Recommended fix.** Treat the fields as possibly absent, drop incomplete entries, and show the rest.

*Feasibility: achievable · Independently re-discovered by the red team as RT-F009*


#### F031 — The response templates that tell the AI what shape to return are checked against nothing

**High** · `boundary-without-validation` · `src/lib/ai/schemas.ts`:3 · discovery (L05) · confidence: high

**What it is.** The app relies on three templates to constrain what the AI sends back. Because of how the AI library declares that setting, those templates receive no checking at all — a misspelled keyword inside one would be accepted silently.

**Why it matters.** These templates are the only shape enforcement in the entire AI path; there is no validation afterwards. If one silently stops working, malformed AI output flows straight into permanent storage.

<details><summary>Technical detail</summary>

All three schema constants are bare object literals with no type annotation and no `satisfies Schema`. They are passed to `config.responseSchema`, whose declared type in the SDK is `SchemaUnion` — and `node_modules/@google/genai/dist/genai.d.ts:12090` declares `export declare type SchemaUnion = Schema | unknown;`, which collapses to `unknown`. So the compiler accepts literally any value there. Because the constants are assigned to untyped `const`s first, object-literal freshness is lost and excess-property checking never applies at the call site either. Net effect: a typo (`requred` instead of `required`, `properites` instead of `properties`), a misplaced `description`, or a nested `items` on a non-ARRAY field compiles cleanly, ships, and silently degrades the request to an unconstrained one. That matters more here than anywhere else in the app: with no runtime validation on any of the three parse sites (L05-F01, L05-F04, L05-F05), this schema is the *sole* thing keeping model output in shape. The SDK's `Schema` interface (genai.d.ts:12043-12088) is a real, checkable type with `properties?: Record<string, Schema>`, `required?: string[]`, `items?: Schema`, `enum?: string[]`, `minimum`/`maximum`, `minItems`/`maxItems` — annotating each constant `satisfies Schema` is a trivial, zero-runtime-cost fix that would catch the whole class. Blast radius: 3 schemas consumed by 4 request sites (summarize.ts:49, summarize.ts:70, quiz.ts:13, recommend.ts:27). Verified negative worth recording: `GENERIC_BOOK_SCHEMA`'s 9 properties and `RawBookResponse`'s 9 fields match exactly with no drift in either direction.

```
1 | import { Type } from '@google/genai';
   2 |
   3 | export const GENERIC_BOOK_SCHEMA = {
   4 |   type: Type.OBJECT,
   5 |   properties: {
   6 |     title: { type: Type.STRING },

// node_modules/@google/genai/dist/genai.d.ts
 5204 |     responseSchema?: SchemaUnion;
12090 | export declare type SchemaUnion = Schema | unknown;
```

**Verification (confirmed).** Pattern present and unchanged: src/lib/ai/schemas.ts:3, :36 and :55 declare GENERIC_BOOK_SCHEMA, RECOMMENDATION_SCHEMA and QUIZ_SCHEMA as bare `export const` object literals with no annotation and no `satisfies`. The SDK claim checks out verbatim: node_modules/@google/genai/dist/genai.d.ts:5204 is `responseSchema?: SchemaUnion;` and :12090 is `export declare type SchemaUnion = Schema | unknown;` — a union with `unknown` collapses to `unknown`, so the four call sites type-check nothing. I proved both halves experimentally with the repo's own tsc (`npx tsc --ignoreConfig --noEmit --strict --moduleResolution bundler`) on a scratch file, since deleted: (a) the CURRENT literal shape compiles unchanged when `satisfies Schema` is appended — including the nested `items`/`properties`/`required` structure — so the fix is a pure annotation, and (b) the same annotation rejects the exact defect class claimed, emitting `error TS2561: Object literal may only specify known properties, but 'properites' does not exist in type 'Schema'. Did you mean to write 'properties'?`. Verified negative also holds: the 9 names in `required` (schemas.ts:23-33) match `RawBookResponse`'s 9 fields (schemas.ts:87-97) exactly, so there is no current drift.

**Reachability.** Not a live bug — a latent guard gap on the app's only Gemini shape-enforcement layer. It becomes a real one the moment anyone hand-edits a schema (CLAUDE.md names an imminent refactor pass). A mistyped key silently degrades the request to unconstrained JSON, and because none of the four parse sites runs any runtime validation (summarize.ts:52, summarize.ts:73, quiz.ts:16, recommend.ts:30 all `JSON.parse(...) as T`), nothing downstream would surface the degradation.

**Blast radius.** 3 exported constants in one 97-line module, consumed at 4 request sites: src/lib/ai/summarize.ts:49, src/lib/ai/summarize.ts:70, src/lib/ai/quiz.ts:13, src/lib/ai/recommend.ts:27.

</details>

**Recommended fix.** Attach the library's own template type to each of the three constants so typos and structural mistakes become compile errors. This has been proven to compile unchanged today.

*Feasibility: achievable · Independently re-discovered by the red team as RT-F301*


#### F034 — A blocked or truncated AI reply is turned into an empty result and saved as a real summary

**High** · `boundary-without-validation` · `src/lib/ai/summarize.ts`:52 · discovery (L05) · confidence: high

**What it is.** When the AI returns nothing — because the request was blocked, or the reply was cut short — the app substitutes an empty placeholder instead of treating it as a failure.

**Why it matters.** The user gets a book record that looks complete but has an empty title, no insights and a zero reading time, permanently stored. The real reason for the failure is thrown away and never surfaced.

<details><summary>Technical detail</summary>

The SDK types the accessor as `get text(): string | undefined` (genai.d.ts:5338). `undefined` is the real signal for a safety-blocked prompt, a `MAX_TOKENS` truncation, or an empty `candidates` array. `|| '{}'` coerces that signal away — and unlike a `!`, it fails silently instead of throwing. The empty object then flows through `toGenerated` (lines 22-41), where every field has a fallback: `data.title || fallbackTitle`, `data.category || 'Other'`, `data.rating ?? 0`, `data.readingTimeMinutes ?? 5`, `'No takeaway available.'`, `'No summary available.'`, `keyInsights: []`, `actionableSteps: []`. The function returns a structurally perfect `GeneratedBook` and its type promises a real generated summary. LibraryPage.tsx:90-94 then writes that straight to IndexedDB via `addBook`, and AddBookModal.tsx:69-79 does the same. The user asked for a summary, Gemini refused, and BookSum silently saves a book whose summary reads 'No summary available.' with an empty insights list — with no error surfaced anywhere (the catch on line 55 never fires). `'{}'` is also indistinguishable from the model legitimately returning `{}`. Correct behavior: treat `response.text === undefined` (or an empty/blocked `candidates[0]`) as an `AiError` of kind `'safety'` or `'malformed'` — `src/lib/ai/errors.ts:1-9` already has both kinds and user-facing copy for them (errors.ts:33,35), so nothing new needs designing. Same pattern at line 73 for the PDF path, quiz.ts:16 and recommend.ts:30. Blast radius: 4 parse sites; 2 UI entry points persist the result.

```
49 |      config: { responseMimeType: 'application/json', responseSchema: GENERIC_BOOK_SCHEMA },
  50 |    });
  51 |
  52 |    const data = JSON.parse(response.text || '{}') as RawBookResponse;
  53 |    const cover = await fetchCover(data.title || title, data.author || author || '');
  54 |    return toGenerated(data, title, author || 'Unknown', cover, 'Want to Read', false);

// node_modules/@google/genai/dist/genai.d.ts
 5338 |     get text(): string | undefined;
```

**Verification (confirmed).** Confirmed end-to-end, and the strongest finding in this batch. src/lib/ai/summarize.ts:52 and :73 are `JSON.parse(response.text || '{}') as RawBookResponse`; the SDK accessor really is `get text(): string | undefined` (node_modules/@google/genai/dist/genai.d.ts:5338), so `|| '{}'` erases the undefined-means-blocked-or-truncated signal AND the empty-string case. I walked the fallback chain: with `{}`, every field in `toGenerated` (summarize.ts:24-37) resolves to a default — title/author/category/rating/readingTimeMinutes plus 'No takeaway available.', 'No summary available.', `[]`, `[]` — so the function returns a structurally perfect `GeneratedBook` whose type promises a real summary. `JSON.parse('{}')` cannot throw, so the `catch` at :55 never fires. Persistence verified: AddBookModal.tsx:69-79 and LibraryPage.tsx:90-94 both call `addBook`, which writes the summary at useLibrary.tsx:48. The recommended handling needs nothing new — src/lib/ai/errors.ts:6,8 already declare 'safety' and 'malformed' and :33,:35 already carry the user-facing copy, and AppShell already routes AiError to a toast.

**Reachability.** Ordinary user path. `summarizeBookPrompt` interpolates the user's own book title (prompts.ts:4), so a title that trips a safety filter, a quota/candidate-less response, or a MAX_TOKENS cut on the 350-500-word summary all produce `text === undefined`. The user clicks Add Book, sees no error at all, and a book titled correctly but reading 'No summary available.' with zero insights is written durably to IndexedDB.

**Blast radius.** 4 parse sites share the pattern (summarize.ts:52, summarize.ts:73, quiz.ts:16, recommend.ts:30); 2 UI entry points persist the fabricated result.

</details>

**Recommended fix.** Treat a missing reply as an explicit failure using the error vocabulary the app already has, so the user is told what happened.

*Feasibility: achievable*


#### F035 — A failed deep-dive generation is returned as if it were the finished text

**High** · `discriminated-union-opportunity` · `src/lib/ai/summarize.ts`:99 · discovery (L05) · confidence: high

**What it is.** When the long-form summary generation produces nothing, the routine returns an apology string. As far as everything downstream is concerned, that string is the summary.

**Why it matters.** The apology text gets saved as the book's deep dive, shown in the reader, counted in exports and word counts, and there is no way to tell it apart from real content afterwards.

<details><summary>Technical detail</summary>

The declared return `Promise<string>` makes success and failure structurally identical — the caller cannot tell 'the model produced this markdown' from 'generation produced nothing'. `text` is empty whenever the stream yields no chunks: a safety block, an immediate `MAX_TOKENS` cut, or an empty candidate list (chunk.text is `string | undefined` per genai.d.ts:9465, and line 95 already coalesces it to ''). The sentinel is not just cosmetic — BookDetail.tsx:184-186 does `const longSummary = await generateDetailedSummary(...); const updated = { ...summary, detailedSummary: longSummary }; onSummaryUpdate(updated);`, persisting the literal string 'Failed to generate detailed summary.' into `Summary.detailedSummary` in IndexedDB. BookDetail.tsx:176 then short-circuits on `if (summary?.detailedSummary)` and opens the reader without regenerating, so from that point on the 'Read Full Summary' button permanently opens a reader displaying the failure message, with no UI path to retry. The catch on line 188 never fires because nothing threw. Correct shape: either throw an `AiError` (kind `'malformed'` or `'safety'` already exist in errors.ts:1-9) when `text` is empty, or return a tagged union (`{ ok: true; text: string } | { ok: false; reason: AiErrorKind }`) so the compiler forces the caller to handle the empty case before writing to storage. Blast radius: 1 call site (BookDetail.tsx:184), but the bad value is durable and self-perpetuating.

```
93 |    let text = '';
  94 |    for await (const chunk of stream) {
  95 |      text += chunk.text ?? '';
  96 |      onChunk?.(text);
  97 |    }
  98 |
  99 |    return text || 'Failed to generate detailed summary.';

// src/components/BookDetail.tsx:184-186 — the sentinel is persisted as if it were content
 184 |      const longSummary = await generateDetailedSummary(book, summary);
 185 |      const updated = { ...summary, detailedSummary: longSummary };
```

**Verification (confirmed).** Confirmed, and the persistence chain is real — I traced it rather than assuming it. src/lib/ai/summarize.ts:93-99: `text` accumulates `chunk.text ?? ''` and the function returns `text || 'Failed to generate detailed summary.'`, so the failure sentinel is indistinguishable from content in the declared `Promise<string>`. src/components/BookDetail.tsx:184-186 assigns it to `detailedSummary` and calls `onSummaryUpdate(updated)`; src/features/book/BookDetailPage.tsx:44-46 wires that to `void saveSummary(next)`; src/features/library/useLibrary.tsx:80 calls `summaryRepo.upsert(summary)` UNCONDITIONALLY — this is line 80, not the known-dead backfill at useLibrary.tsx:82-83, so the dead-code caveat from earlier batches does not apply here. Self-perpetuation verified at BookDetail.tsx:176: `if (summary?.detailedSummary) { onOpenReader(book); return; }` short-circuits before any regeneration, so the reader opens on the failure string forever. The `catch` at summarize.ts:100 never fires because nothing threw, and the `catch` at BookDetail.tsx:188 is likewise never reached. errors.ts:6,8 already declare 'safety'/'malformed', so no new design is needed.

**Reachability.** User clicks 'Read Full Summary' / Masterclass on a summarised book. `text` is '' whenever the stream yields no text chunks — a safety block, an immediate MAX_TOKENS cut, or an empty candidate list. There is no UI path to retry afterwards: the only escapes are deleting the book or editing IndexedDB by hand.

**Blast radius.** 1 call site (BookDetail.tsx:184) but the damage is durable (IndexedDB) and self-perpetuating. Sibling pattern at src/lib/ai/chat.ts:35 is reported separately as F076 (medium) and is NOT durable, which is the right relative rating.

</details>

**Recommended fix.** Raise a failure instead of inventing content; the caller already has error handling that would show the user a proper message.

*Feasibility: achievable*


#### F037 — Decoding attached files during the upgrade can throw and stop startup dead

**High** · `boundary-without-validation` · `src/lib/base64.ts`:5 · discovery (L07) · confidence: high

**What it is.** The routine that decodes stored file attachments claims it always succeeds. The underlying browser call fails on any input that is not valid encoded data, and the data it is given comes from unchecked leftover storage.

**Why it matters.** One damaged attachment aborts the whole upgrade partway through. Because the completion marker is written last, the app retries the same upgrade on every reload, duplicating whatever it had already imported.

<details><summary>Technical detail</summary>

`base64ToBytes` (src/lib/base64.ts:5) declares `(base64: string) => Uint8Array<ArrayBuffer>`, a total function, but `atob` throws `DOMException: InvalidCharacterError` on any input outside the base64 alphabet or with misplaced padding (verified in a node harness). Its production callers, migrate.ts:136 and :142, pass `legacy.pdfData`/`legacy.audioData` straight out of `JSON.parse(raw) as LegacyBook[]` (migrate.ts:58) — unvalidated localStorage — guarded only by a truthiness check, and there is no try/catch anywhere on the path (migrate.ts:80, ProfileContext.tsx:30-42). One malformed value therefore (a) skips `setIsLoading(false)` at ProfileContext.tsx:41 so the app hangs on its loading state, and (b) throws after `profiles.create()` (migrate.ts:90) and `books.create()` (:105) but before `localStorage.setItem(MIGRATION_MARKER, ...)` (:149), so every reload re-runs the migration and accumulates duplicate profiles, books and summaries. CORRECTION to the original write-up: a `data:application/pdf;base64,...` value is NOT how the pre-IndexedDB app stored PDFs — commit 670b5fe:components/AddBookModal.tsx:28 strips the prefix with `.split(',')[1]` and 670b5fe:components/BookDetail.tsx:137 decodes the raw base64 — so the trigger is a corrupted, truncated, hand-edited or foreign-version localStorage value rather than the ordinary legacy shape. Severity remains high: the ingress is external, the declared-total return is what let the call site skip its guard, and the failure is an unrecoverable boot hang plus silent data duplication.

```
5 export function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
6   const binary = atob(base64);
7   const bytes = new Uint8Array(new ArrayBuffer(binary.length));
8   for (let i = 0; i < binary.length; i += 1) {
9     bytes[i] = binary.charCodeAt(i);
10   }
11   return bytes;
12 }

// src/lib/storage/migrate.ts:135-137 (unguarded call over `JSON.parse(...) as LegacyBook[]`)
135       if (legacy.pdfData) {
136         const bytes = base64ToBytes(legacy.pdfData);
```

**Verification (amended).** Confirmed on substance; amended on one factual claim. The signature at src/lib/base64.ts:5 is `base64ToBytes(base64: string): Uint8Array<ArrayBuffer>` — total in its type, partial in fact. I re-proved the runtime behaviour in node: 'data:application/pdf;base64,JVBERi0x', 'not base64!!' and 'AA=A' all throw `DOMException InvalidCharacterError`, while 'SGVsbG8' (unpadded) and '' succeed. The unguarded path is intact: migrate.ts:135-145 calls it behind a truthiness check only; `migrateLegacyData` (migrate.ts:80-151) has no try/catch; its only caller, ProfileContext.tsx:30-42, runs it as `void (async () => { await migrateLegacyData(); ... setIsLoading(false); })()` with no handler, so a throw skips `setIsLoading(false)` at :41 and the app is stuck loading. The re-run corruption is real: the throw precedes `localStorage.setItem(MIGRATION_MARKER, ...)` at migrate.ts:149 but follows `profiles.create()` at :90 and `books.create()` at :105, so every reload re-runs the whole migration and accumulates duplicates. Also confirmed: `bytesToBase64` (base64.ts:14) has no production caller — grep finds it only in base64.test.ts. AMENDMENT: the finding calls a `data:...;base64,` value 'the natural way for the pre-IndexedDB app to have stashed a PDF'. That is verifiably wrong — the original app at commit 670b5fe stripped the prefix (`components/AddBookModal.tsx:28`: `const base64 = (reader.result as string).split(',')[1];`) and decoded it with a bare `atob(book.pdfData)` at `components/BookDetail.tsx:137`, so the known legacy producer emitted clean base64. Severity stays high: localStorage is still an external, user- and extension-writable ingress read on the boot path, the declared-total return is exactly what let the call site be written without a guard, and the consequence is a permanent boot hang plus duplicate-record accumulation.

**Reachability.** Boot path for any user with legacy `booksum_library_*` data. The trigger is a malformed `pdfData`/`audioData` value — NOT produced by the known legacy app, so in practice it needs a truncated, hand-edited, extension-written or foreign-version localStorage entry. Once triggered it is unrecoverable from the UI: the spinner never clears and each reload duplicates profiles, books and summaries. The third call site, tts.ts:30, is safe — it sits inside a try/catch (tts.ts:31) that normalises to AiError.

**Blast radius.** 2 production call sites on the boot path (migrate.ts:136, migrate.ts:142) plus 1 already-guarded AI call site (tts.ts:30). Call-site mirror F097 (medium) and boundary mirror F007 (critical) describe the same path; F037 is the producer-side root and the right place for the fix.

</details>

**Recommended fix.** Let the decoder report failure, and make the upgrade skip an unreadable attachment instead of abandoning the entire process.

*Feasibility: achievable · Independently re-discovered by the red team as RT-F007*


#### F040 — The AI's chosen correct-answer position is stored forever without ever being range-checked

**High** · `boundary-without-validation` · `src/lib/srs.ts`:18 · discovery (L07) · confidence: high

**What it is.** The number identifying which answer is correct is copied straight from the AI's reply into a permanent review card, with nothing confirming it points at an option that exists.

**Why it matters.** An out-of-range value makes a card impossible to answer correctly. It never crashes, so nothing signals the problem; the card simply comes back day after day forever.

<details><summary>Technical detail</summary>

`NewCardInput.correctAnswerIndex` is typed `number` and `newCard` copies it verbatim into a persisted `ReviewCard` (srs.ts:29) with no bounds check against `input.options`. The producer is `src/lib/ai/quiz.ts:16`, which does `JSON.parse(response.text || '{}') as { questions?: QuizQuestion[] }` — an unvalidated assertion over model output. The Gemini `responseSchema` at `src/lib/ai/schemas.ts:69-71` declares only `type: Type.NUMBER`; the range constraint lives in a `description` string ('Index (0-3) of the correct answer'), which is a prompt hint, not an enforced constraint. Structured output guarantees the JSON *type*, not the *range*.

Correct behaviour: `newCard` is the last gate before `reviewCards.upsert` writes to IndexedDB, so it must reject (or clamp) an index outside `0 <= i < options.length` and reject an `options` array that is empty. The type should express 'a valid index into options' — either a branded/refined index or a single `{ options, correctIndex }` value constructed through one validating factory — rather than two independent primitives.

Failure mode: a model that answers 1-indexed returns `correctAnswerIndex: 4` for a 4-option question. Nothing rejects it. The card is written to IndexedDB permanently. Thereafter `ReviewPage.tsx:94` (`showCorrect = isAnswered && index === current.correctAnswerIndex`) is false for every option, so no green 'correct' answer is ever shown, and `ReviewPage.tsx:76` (`isCorrect = selected === current.correctAnswerIndex`) is permanently false. The card stays in rotation forever and can never be answered correctly. No exception, no log, no way for the user to tell it is broken. Note the test suite already constructs exactly this impossible state and the types permit it: `src/features/review/reviewQueue.test.tsx:149-150` passes `options: []` with `correctAnswerIndex: 0`.

Blast radius: type declared at `src/lib/srs.ts:18` and `src/types.ts:89,108`; produced at `src/lib/ai/quiz.ts:16`; the sole persistence gate is `newCard` (`src/lib/srs.ts:22-36`), called from `src/components/QuizModal.tsx:53-60`; consumed at `src/features/review/ReviewPage.tsx:76,94` and `src/components/QuizModal.tsx:78,183`. Every generated quiz question in the app flows through this one line, and the damage is durable because it is written to IndexedDB.

```
13 export interface NewCardInput {
14   profileId: string;
15   bookId: string;
16   question: string;
17   options: string[];
18   correctAnswerIndex: number;
19   explanation: string;
20 }
...
28     options: input.options,
29     correctAnswerIndex: input.correctAnswerIndex,
```

**Verification (confirmed).** Confirmed and, of the ten findings covering this defect, this is the one that names the right fix location. src/lib/srs.ts:13-20 declares `NewCardInput` with `options: string[]` and `correctAnswerIndex: number` as two unrelated primitives, and `newCard` (srs.ts:22-36) copies the index verbatim at line 29 with no bounds check. Producer verified: quiz.ts:16 is `JSON.parse(response.text || '{}') as { questions?: QuizQuestion[] }` with no guard, and the attached schema (schemas.ts:69-71) constrains only `type: Type.NUMBER` — the 0-3 range is prose in a `description`. Persistence gate verified: QuizModal.tsx:52-61 calls `reviewCards.upsert(newCard({...}))` inside the load effect, so `newCard` really is the last code that touches the value before IndexedDB. Consumers verified: ReviewPage.tsx:76 (`isCorrect = selected === current.correctAnswerIndex`) and :94 (`showCorrect = isAnswered && index === current.correctAnswerIndex`) are both permanently false for an out-of-range index, and QuizModal.tsx:78/:183 likewise. The impossible-state claim about the test suite is exact: src/features/review/reviewQueue.test.tsx:144-152 builds a card with `options: []` and `correctAnswerIndex: 0` and the types accept it. Types confirmed at src/types.ts:89 and :108. Kept at high rather than folded into F005 because this is the single chokepoint fix: F005/F016/F017/F024/F025/F032/F052/F072/F107 all describe the same defect at other layers, and the report should collapse them into one patch landed here.

**Reachability.** Any user who takes a Knowledge Check on any book. A model that answers 1-indexed returns `correctAnswerIndex: 4` for a 4-option question; nothing rejects it, the card is written to IndexedDB, and from then on the review card can never be answered correctly, never leaves rotation, and shows no correct answer — with no exception, no log and no user-visible signal.

**Blast radius.** Declared at src/lib/srs.ts:18 and src/types.ts:89,108; produced at src/lib/ai/quiz.ts:16; single persistence gate `newCard` (src/lib/srs.ts:22-36) called from src/components/QuizModal.tsx:53-60; consumed at src/features/review/ReviewPage.tsx:76,94 and src/components/QuizModal.tsx:78,183. Every generated quiz question in the app passes through this one function, and the write is durable.

</details>

**Recommended fix.** Make the card factory validate the answer position against the option list and reject cards that fail.

*Feasibility: achievable*


#### RT-F005 — One transient database failure disables all storage for the rest of the session

**High** · `untyped-public-function` · `src/lib/storage/db.ts`:23 · red team (lying-types) · confidence: high

**What it is.** The connection to the local database is opened once and remembered. If that first attempt fails, the failed attempt is remembered too, and every later request reuses it.

**Why it matters.** A single transient failure — private browsing, a storage block, a version conflict — permanently breaks every read and write in the app until the tab is reloaded. Nothing retries, and nothing tells the user.

<details><summary>Technical detail</summary>

`getDb(): Promise<IDBPDatabase<BookSumDB>>` is the root of every storage contract in the app, and its declared type says nothing about failure. `dbPromise` is assigned synchronously at line 23 and is only ever cleared by the test-only `resetDb()`. If `openDB` rejects even once — storage denied in Safari private browsing, a blocked upgrade because another tab holds the old version, the user clearing site data mid-session, or an origin over quota — the REJECTED promise stays cached, and every later `getDb()` returns that same rejected promise. There is no retry path. Every declared-total signature downstream then lies at once: `profiles.list(): Promise<Profile[]>`, `books.listByProfile(): Promise<Book[]>`, `summaries.getByBook(): Promise<Summary | undefined>`, `blobs.get(): Promise<Blob | undefined>` — all reject. Broken consumers, none of which catch: `useLibrary.reload` (useLibrary.tsx:22-34) never reaches `setIsLoading(false)`, so the library shows its spinner forever; `ProfileContext` (ProfileContext.tsx:30-42) likewise never clears `isLoading`, so App.tsx:12 renders the full-screen spinner and, with no top-level error boundary in main.tsx, nothing is ever reported to the user. This is a distinct root cause from RT-F002 with the same terminal symptom.

```
19: let dbPromise: Promise<IDBPDatabase<BookSumDB>> | null = null;
 21: export function getDb(): Promise<IDBPDatabase<BookSumDB>> {
 22:   if (!dbPromise) {
 23:     dbPromise = openDB<BookSumDB>(DB_NAME, DB_VERSION, {   // rejection is cached forever
 42:   return dbPromise;
 43: }
```

</details>

**Recommended fix.** Clear the remembered connection when the attempt fails, so the next call retries instead of replaying the failure.


#### F007 — Leftover data from the old version of the app is trusted blindly while the app is starting

**High** · `boundary-without-validation` · `src/lib/storage/migrate.ts`:58 · discovery (L03) · confidence: high

**What it is.** On first launch the app reads leftover data saved by the previous version and assumes it has exactly the expected shape. Nothing inspects it before use.

**Why it matters.** If that leftover data is damaged, startup fails before the app can display anything, and the marker that says the one-time upgrade is finished never gets written, so the same failure repeats on every reload.

<details><summary>Technical detail</summary>

src/lib/storage/migrate.ts:54-62's `readJson<T>` is a generic assertion factory: it hands `JSON.parse` output straight back as `T` (line 58) with zero runtime checking, and its catch handles syntax errors only. localStorage is user-writable external data, so `T` is fiction. Two call sites: line 89 (`LegacyProfile`, benign — the optional chaining at 91-95 short-circuits on any primitive) and line 99 (`LegacyBook[]`), where line 101's `for (const legacy of legacyBooks)` throws TypeError on any non-iterable and silently mints one 'Untitled' book per character on a string. The consequence is out of all proportion to the call count: migrateLegacyData() is awaited unguarded as the first statement of ProfileContext.tsx:30-42's `void`-ed boot effect, so a throw skips `setIsLoading(false)` at line 41 and leaves App.tsx:12-18 on its loading spinner forever; the rejection is unhandled and never reaches the errorElement at routes.tsx:16; and MIGRATION_MARKER is only written at migrate.ts:149, after the loop, so every subsequent reload fails identically with partially-written IndexedDB records. Severity is High rather than Critical because no shipped BookSum can produce the malformed value — the original app always wrote a JSON array to this key (670b5fe:App.tsx:212) — so the crash requires DevTools, an extension, or a same-origin key collision rather than any user action.

```
54  function readJson<T>(key: string): T | null {
55    const raw = localStorage.getItem(key);
56    if (!raw) return null;
57    try {
58      return JSON.parse(raw) as T;
59    } catch {
60      return null;
61    }
62  }
...
99      const legacyBooks = readJson<LegacyBook[]>(`${LIBRARY_KEY_PREFIX}${userId}`) ?? [];
101     for (const legacy of legacyBooks) {
```

**Verification (amended).** Pattern, call sites and consequences all confirmed at the cited lines; only the severity overreaches. CONFIRMED: src/lib/storage/migrate.ts:54-62 is a generic assertion factory — `function readJson<T>(key: string): T | null` returning `JSON.parse(raw) as T` at line 58, with the catch handling syntax errors only. Exactly 2 call sites, both as claimed: line 89 `readJson<LegacyProfile>` and line 99 `readJson<LegacyBook[]>(...) ?? []`, with the for-of at line 101 immediately after. I traced both failure modes: a non-iterable value throws TypeError at 101 (the `??` only rescues `null`); a string value iterates its characters and, since every LegacyBook field is optional (lines 17-36) and every read is `?? default` (lines 107-118), silently creates one 'Untitled'/'Unknown' book per character. Line 89's misuse is benign by luck — `legacyProfile?.name?.trim()` short-circuits on primitives. The boot-path consequence is confirmed exactly: ProfileContext.tsx:30-42's `void (async () => { await migrateLegacyData(); ... })()` means a throw skips `setIsLoading(false)` at line 41, so App.tsx:12-18 renders the spinner forever; the rejection is unhandled (not routed to routes.tsx:16's errorElement); and MIGRATION_MARKER is written last at migrate.ts:149, so the next launch repeats it. WHY NOT CRITICAL: the Critical bar in the spec is 'a path that's exercised in production'. No shipped BookSum can write a non-array under `booksum_library_*` — the original app at 670b5fe:App.tsx:212 always does `localStorage.setItem(userLibraryKey, JSON.stringify(books))` on a `BookInsight[]`. Reaching the throw requires DevTools, an extension, or a foreign app colliding on the same origin (a real risk on a shared *.github.io origin, which Phase 4 plans). That is a genuine unvalidated-boundary defect on a known-runtime-data ingress — textbook High — but not a production-exercised crash. Critical -> High.

**Reachability.** Not reachable through any in-app action. The malformed value must be written to localStorage by something other than BookSum (DevTools, an extension, or another app sharing the origin). If it is, the path is: any app load -> ProfileContext.tsx:31 -> migrate.ts:99 -> throw at 101 -> permanent loading spinner (App.tsx:12-18), no error boundary, marker never written, identical failure on every subsequent reload, with partially-written IndexedDB records that the happy-path idempotence test (migrate.test.ts:137-144) says nothing about.

**Blast radius.** 2 call sites (migrate.ts:89, 99) inside one module-private helper. Execution blast radius is total: migrateLegacyData() is the first awaited statement of the app-boot effect for 100% of users on 100% of loads (ProfileContext.tsx:31).

</details>

**Recommended fix.** Read the leftover data as untrusted, verify its shape, and skip anything that does not fit rather than assuming the whole thing is valid.

*Feasibility: achievable · Severity amended from critical → high during verification*


#### F043 — The upgrade from the old app forgets one field, so every migrated book looks unsummarised

**High** · `discriminated-union-opportunity` · `src/lib/storage/migrate.ts`:105 · discovery (L03) · confidence: high

**What it is.** When old books are brought across, the link to their summary is written but the short headline that list views depend on is left out, even though that text is available at the time.

**Why it matters.** This is deterministic for every single migrated book: the library shows 'Not summarised yet' while the book's own page shows the summary. The existing migration test asserts the link but never the headline, so it stays green.

<details><summary>Technical detail</summary>

This is a real bug the type system should have caught. CLAUDE.md states oneSentenceTakeaway is deliberately denormalised onto Book so list views render without loading every summary. The normal creation path honours that (src/features/library/LibraryPage.tsx:92 spreads `{ ...book, oneSentenceTakeaway: summary.oneSentenceTakeaway }`), but the migration at lines 105-119 sets `summaryId` and then writes a full Summary at line 122-132 with `oneSentenceTakeaway: legacy.oneSentenceTakeaway ?? ''` while never backfilling the Book copy. Result: src/components/BookCard.tsx:89 renders `book.oneSentenceTakeaway ? ... : 'Not summarised yet'`, so every book imported from the legacy app displays 'Not summarised yet' in the library grid despite having a complete migrated summary. It compiles because types.ts declares `summaryId?: string` and `oneSentenceTakeaway?: string` as two independent optionals, so the impossible state 'summarised but no takeaway' is representable. A discriminated union - a summarised variant requiring both fields, an unsummarised variant permitting neither - would have made this a compile error, both here and at repo.ts:51-53 where the create input type inherits the same weakness. Blast radius: the bug hits every migrated book on the primary library screen; the type weakness covers all 22 books.* call sites.

```
105      const book = await books.create({
114          coverImageUrl: legacy.coverImageUrl ?? '',
115          readingTimeMinutes: legacy.readingTimeMinutes ?? 5,
117          summaryId,            // <- set, but oneSentenceTakeaway never denormalised
118          hasPdf: Boolean(legacy.pdfData),
119        });
122      await summaries.upsert({
125          oneSentenceTakeaway: legacy.oneSentenceTakeaway ?? '',

// consumer, src/components/BookCard.tsx:89
89        {book.oneSentenceTakeaway ? `"${book.oneSentenceTakeaway}"` : 'Not summarised yet'}
```

**Verification (confirmed).** Real, shipped, user-visible bug — confirmed line by line. src/lib/storage/migrate.ts:105-119 calls `books.create({...})` with profileId, title, author, category, status, priority, rating, personalNotes, coverImageUrl, readingTimeMinutes, addedAt, summaryId and hasPdf — and no `oneSentenceTakeaway` key. repo.ts:54-58 does `const book: Book = { ...input, id, addedAt }` and persists verbatim, so the field is genuinely absent on disk. migrate.ts:122-132 then writes the full Summary including `oneSentenceTakeaway: legacy.oneSentenceTakeaway ?? ''` at line 125, so the data exists but never reaches the Book. src/components/BookCard.tsx:89 reads exactly that field and renders 'Not summarised yet'. I verified there is no repair path: the only other producers set it correctly (AddBookModal.tsx:72 and LibraryPage.tsx:92, both through useLibrary.tsx addBook), and per the established baseline the backfill at useLibrary.tsx:82-83 is dead code — I re-confirmed that independently: saveSummary's only caller is BookDetailPage.tsx:44-47, wired to BookDetail.tsx's `onSummaryUpdate`, whose only invocation is BookDetail.tsx:186 inside handleGenerateDeepDive, which operates on an already-existing `summary` whose id already equals `book.summaryId`, so `book.summaryId !== summary.id` is never true. And even if it fired, it writes summaryId, not oneSentenceTakeaway. So a migrated book displays 'Not summarised yet' forever. `npx vitest run src/lib/storage/migrate.test.ts src/lib/storage/repo.test.ts` is 16/16 green, so nothing in the suite catches it (see F041). The type-level cause is real too: types.ts:48-50 declares summaryId and oneSentenceTakeaway as independent optionals, so the incomplete create call type-checks (baseline: `tsc --noEmit` is clean).

**Reachability.** Any user with pre-IndexedDB localStorage data. ProfileContext.tsx:31 awaits migrateLegacyData() on first boot, then every migrated book on the primary library grid (BookCard.tsx:89, rendered by LibraryPage and StatsView.tsx:119) shows 'Not summarised yet' despite having a complete Summary reachable at BookDetail.tsx:452.

**Blast radius.** One producer line, but it affects 100% of migrated books on the app's primary screen. The permitting type weakness spans the 14 non-test `books.*` call sites and the 33 files importing from src/types.ts.

</details>

**Recommended fix.** Write the headline alongside the summary link in the same operation, and extend the migration test to assert it.

*Feasibility: achievable*


#### F044 — Old book records are patched with default values that only guard against blanks, not against wrong data

**High** · `boundary-without-validation` · `src/lib/storage/migrate.ts`:110 · discovery (L03) · confidence: high

**What it is.** The upgrade fills in missing fields with sensible defaults, but the mechanism used only replaces values that are entirely absent. A wrong-typed or nonsense value passes straight through.

**Why it matters.** Text where a number is expected, or an unrecognised reading status, gets written into permanent storage and then breaks arithmetic and filtering on the statistics and library screens.

<details><summary>Technical detail</summary>

Lines 106-118 use `??` as if it were validation. `??` substitutes only for null/undefined: any other value - a string where a number is declared, an unknown status string, an object - passes through untouched and is written by books.create as a `Book`. `legacy.status ?? 'Want to Read'` therefore persists `Book.status: BookStatus` holding e.g. 'Reading' or 'Currently Reading'; StatsView.tsx:15-16 buckets books by `b.status === 'Finished'` / `=== 'Want to Read'`, so such a book vanishes from both stat buckets and from the status filter while still counting in the library total. `legacy.rating ?? 0` and `legacy.readingTimeMinutes ?? 5` feed the arithmetic at StatsView.tsx:17-19 (see L03-F05) - a string there turns the reading-time total into concatenated digits. `legacy.priority` is passed with no default at all and is declared `Priority`. Blast radius: every migrated book, consumed by all 22 books.* call sites. Correct behaviour: a membership check for the union fields and a `typeof === 'number'` check for the numeric ones, falling back to the default when the check fails rather than only when the value is nullish.

```
106        profileId: profile.id,
110        status: legacy.status ?? 'Want to Read',
111        priority: legacy.priority,
112        rating: legacy.rating ?? 0,
115        readingTimeMinutes: legacy.readingTimeMinutes ?? 5,

// declaration asserting current unions over raw JSON, migrate.ts:30-33
30     priority?: Priority;
33     status?: BookStatus;
```

**Verification (confirmed).** Confirmed, and stronger than the discoverer knew. Pattern verified at migrate.ts:106-118: `status: legacy.status ?? 'Want to Read'` (110), `priority: legacy.priority` with no default at all (111), `rating: legacy.rating ?? 0` (112), `readingTimeMinutes: legacy.readingTimeMinutes ?? 5` (115) — all over an interface (migrate.ts:17-36) that declares current-app unions (`priority?: Priority`, `status?: BookStatus`) for values produced by `JSON.parse(raw) as T` at migrate.ts:58. `??` guards nullish only; anything else is written verbatim by repo.ts:54-59. Where I can go further than the discoverer: the numeric arm is reachable from data the *legacy app itself wrote*, not just hand-edits. `git show 670b5fe:services/geminiService.ts` lines 218-219 read `rating: data.rating || 0` and `readingTimeMinutes: data.readingTimeMinutes || 5` straight off `JSON.parse(response.text || '{}')` (line 205) with no type check, and that object was stringified into `booksum_library_<id>`. So a legacy library can legitimately hold `readingTimeMinutes: '12'`. Downstream I measured the consequence: StatsView.tsx:17 `finished.reduce((acc, b) => acc + b.readingTimeMinutes, 0)` — `0 + '12' + 5` evaluates to the string '0125', so the Total Learning tile renders concatenated digits, and StatsView.tsx:173 `Math.floor(stats.totalTime / 60)` then coerces that nonsense back to a number. The status/priority arm is weaker (the legacy app only ever assigned literal 'Finished'/'Want to Read', 670b5fe App.tsx:128 and 221), so an off-union status needs a hand-edited store — but that arm's consequence is real when it happens: StatsView.tsx:15-16 buckets on strict equality, so such a book disappears from both tiles while still counting in `stats.total` (line 31). Kept at high: this is the batch's canonical `??`-as-validation-over-an-asserted-JSON-boundary finding, and it is the one arm with a producer outside the user's own hands.

**Reachability.** Boot path. ProfileContext.tsx:31 runs the migration before anything else; a legacy library whose Gemini response once returned a stringified number lands a string in Book.readingTimeMinutes, and the Stats page renders the concatenation with no error.

**Blast radius.** 14 non-test `books.*` call sites (the finding's '22' includes test files); listByProfile is the source for every list view, the stats view, export and search.

</details>

**Recommended fix.** Treat the old fields as unknown, check each one, and fall back to the default when the value is not of the expected kind.

*Feasibility: achievable*


#### F048 — The storage layer writes whatever it is handed, with no checks of its own

**High** · `boundary-without-validation` · `src/lib/storage/repo.ts`:52 · discovery (L03) · confidence: high

**What it is.** All writes are funnelled through one storage module by design, but that module performs no validation. It trusts the shape declared by whoever calls it.

**Why it matters.** The backup restore path feeds it a user-picked file, so the one place that could stop bad data reaching permanent storage does not try. Extra fields ride along unnoticed, including the bulky embedded data the project explicitly bans.

<details><summary>Technical detail</summary>

The repo is the mandated chokepoint for all writes (CLAUDE.md layering rule), but the write side performs zero runtime validation - it trusts the static parameter type and calls put(). That static type is a lie on the library-import path: src/components/ProfileView.tsx:117 does `JSON.parse(content) as LibraryExport` on a user-selected .json file, checks only `Array.isArray(data.books)` at line 119, and hands the whole payload to src/features/library/useLibrary.tsx:110-116, which loops `bookRepo.create({ ...book, profileId })` and `summaryRepo.upsert(summary)` per element. Element shapes are never inspected. Two concrete failures: (a) a summaries element lacking `id` makes `put('summaries', ...)` reject with a DOMException DataError (keyPath 'id' yields no value, db.ts:30) mid-loop, after some books have already been written - a partial, non-atomic import; (b) a books element with a missing or wrong-typed field is persisted and thereafter claims to be a `Book` to every reader, corrupting the user's only copy of the library (local-first, no server backup). Note `payload.summaries ?? []` also only guards nullish - a non-array summaries field throws on for-of. Blast radius: 22 `books.*` and 6 `summaries.*` call sites all consume records this path can poison. Correct behaviour: validate at the repo's write boundary (the single place every writer must pass through) rather than trusting an assertion made three modules away.

```
51    async create(
52      input: Omit<Book, 'id' | 'addedAt'> & Partial<Pick<Book, 'id' | 'addedAt'>>,
53    ): Promise<Book> {
54      const book: Book = {
55        ...input,
56        id: input.id ?? newId(),
57        addedAt: input.addedAt ?? new Date().toISOString(),
58      };
59      await (await getDb()).put('books', book);

// caller, src/features/library/useLibrary.tsx:110-116 (payload is `JSON.parse(file) as LibraryExport`)
110      for (const book of payload.books ?? []) {
112        await bookRepo.create({ ...book, profileId: profile.id });
115      for (const summary of payload.summaries ?? []) {
116        await summaryRepo.upsert(summary);
```

**Verification (confirmed).** Confirmed at high — this is the genuine untrusted-data ingress in the batch and the strongest of the repo.ts cluster. Chain verified end to end: src/components/ProfileView.tsx:109-145 reads a user-picked file, line 116-117 does `const content = e.target?.result as string; const data = JSON.parse(content) as LibraryExport;`, line 119 checks only `Array.isArray(data.books)` — nothing inspects element shapes — and line 132 hands the whole payload to onImportLibrary, wired to useLibrary.tsx:102-122. There, line 111 does `await bookRepo.create({ ...book, profileId: profile.id })` and line 115 `await summaryRepo.upsert(summary)`, per element, with no validation. repo.ts:51-60 accepts it on the strength of the static parameter type alone and calls `put('books', book)` on line 59; I proved with the repo's own tsc 6.0.3 that the spread at useLibrary.tsx:111 suppresses excess-property checking entirely, so extra runtime keys (pdfData, audioData, a base64 cover) are copied straight into the object store — the exact defect CLAUDE.md names as what broke the original app. The DataError claim is also correct: db.ts:30 creates `summaries` with an in-line `keyPath: 'id'`, so `put('summaries', ...)` on an element lacking id rejects. One refinement: the failure is not silent — ProfileView.tsx:136-140 wraps the whole flow in try/catch and shows 'Could not read that backup file.' — but the books written before the throw are already committed, so the import is non-atomic and leaves a half-merged library. The `payload.summaries ?? []` note at useLibrary.tsx:114 is right too (a string summaries field iterates by character into upsert). Blast-radius numbers corrected below.

**Reachability.** Ordinary user action, no hand-editing of storage required: Profile -> Data Management -> Restore, then pick any JSON file whose top level has a `books` array. Third-party or hand-edited backups, or backups from a future/older schema, all qualify.

**Blast radius.** The write boundary is 2 lines, but everything downstream consumes what it lets through: 14 non-test `books.*` and 8 non-test `summaries.*` call sites (the finding's '22 / 6' miscounts). Local-first with no server, so a corrupted record is the user's only copy.

</details>

**Recommended fix.** Validate and strip records at this single chokepoint, so every writer is covered by one check rather than each one being trusted individually.

*Feasibility: achievable*


#### F050 — Three separate book fields try to answer one question, and they disagree about how to say 'no'

**High** · `discriminated-union-opportunity` · `src/types.ts`:47 · discovery (L02) · confidence: high

**What it is.** Whether a book has been summarised is expressed by three independent fields, two of which mark absence by being missing while the third uses a zero. Any combination of them is permitted.

**Why it matters.** This is the shared root cause behind the wrong library cards, the wrong statistics, and the controls offered on books that cannot use them. Nothing prevents a new writer from setting one field and forgetting the others.

<details><summary>Technical detail</summary>

src/types.ts:47-50 encodes one fact — is this book summarised — across three independently-mutable fields that disagree on how absence is spelled: `oneSentenceTakeaway?` and `summaryId?` use undefined, while `readingTimeMinutes` is required and uses a magic 0 (written by useLibrary.tsx:157 for every Goodreads row). Six of the eight combinations are impossible states the compiler cannot reject. Live consequences: BookCard.tsx:89 prints 'Not summarised yet' while BookCard.tsx:95 prints '0 min read' on the same card, and StatsView.tsx:17 folds those zeroes into Total Learning, understating it for Goodreads-imported Finished books. The type weakness is also what let migrate.ts:105-119 persist summaryId without oneSentenceTakeaway and still compile (F043). NOTE: the original finding cited useLibrary.tsx:82-83 as a partial-update write path; that branch is dead code (its only caller always passes a summary whose id already matches), so the live inconsistent producers are migrate.ts:105-119 and useLibrary.tsx:150-160.

```
src/types.ts
 41   /**
 42    * Two fields denormalised from Summary onto Book, for one reason: list views
 45    * generated, so Summary remains the source of truth for everything else.
 46    */
 47   readingTimeMinutes: number;
 48   oneSentenceTakeaway?: string;
 49   /** Absent until an AI summary has been generated for this book. */
 50   summaryId?: string;

src/components/BookCard.tsx (both branches render for the same unsummarised book)
 89   {book.oneSentenceTakeaway ? `"${book.oneSentenceTakeaway}"` : 'Not summarised yet'}
 95   <span>{book.readingTimeMinutes} min read</span>
```

**Verification (amended).** Held at high, but one cited write path is wrong and must be replaced. Verified at src/types.ts:41-50: `readingTimeMinutes: number` is required while `oneSentenceTakeaway?` and `summaryId?` are optional, so the three fields that jointly mean 'this book is summarised' disagree on how absence is spelled and 6 of the 8 combinations are representable. The magic-zero claim is right: useLibrary.tsx:150-160 writes `readingTimeMinutes: 0` for every Goodreads row, and GoodreadsRow.status is BookStatus (goodreads.ts:6), so such a book can be 'Finished'. The two-line contradiction is real and I read both: BookCard.tsx:89 narrows the optional and prints 'Not summarised yet' while BookCard.tsx:95 prints '0 min read' on the same card, because a required number has no absent state to narrow — and for a migrated book (F043) the same card prints 'Not summarised yet' next to '12 min read'. What is wrong: the finding's proof that 'no write path is forced to keep them consistent' cites useLibrary.tsx:82-83, which is dead code — saveSummary's only caller is BookDetailPage.tsx:44-47 via BookDetail.tsx:186, which always operates on an existing summary whose id already equals book.summaryId, so the `book.summaryId !== summary.id` branch never runs. The live producer of the inconsistent state is migrate.ts:105-119 (sets summaryId and readingTimeMinutes, omits oneSentenceTakeaway — F043) plus the Goodreads import above; I have swapped the citation. Also softened: StatsView.tsx:17 summing zeroes does not corrupt the total arithmetically, it understates Total Learning for Goodreads-imported Finished books. Severity stays high despite F043 carrying the concrete bug, because this is the type-level cause in the core domain type (33 files import from src/types.ts), it has a different fix from F043, and it covers a second live inconsistency (Goodreads) that F043 does not. The report should present F043 as the instance and F050 as the cause, not as two bugs.

**Reachability.** Two live paths, no hand-editing. (a) Import a Goodreads CSV, then look at the library grid: the card says 'Not summarised yet' and '0 min read' simultaneously (BookCard.tsx:89 and :95), and there is no in-app way to give that book a summary afterwards — books gain summaries only through addBook (AddBookModal, LibraryPage.tsx:91), never for an existing row. (b) Migrate legacy data: the same card says 'Not summarised yet' next to a real reading time (F043).

**Blast radius.** src/types.ts is imported by 33 files; `Book` flows through 14 non-test `books.*` call sites and every list, card, stats, export and markdown renderer.

</details>

**Recommended fix.** Fix the shipped data bug first, then collapse the three fields into one tagged shape so the group can only be written together.

*Feasibility: requires-design*


#### F051 — The backup format is described precisely in the code but never actually verified against a file

**High** · `boundary-without-validation` · `src/types.ts`:98 · discovery (L02) · confidence: high

**What it is.** A detailed description of what a backup file contains exists, but the only place a real file is turned into that description is a bare assumption with no checking.

**Why it matters.** The precise description gives false confidence to every reader and every tool: it looks like the shape is guaranteed when in fact nothing has confirmed it.

<details><summary>Technical detail</summary>

`LibraryExport` is the declared shape of a backup file the user picks off disk. The only place it is constructed from external data is `src/components/ProfileView.tsx:117`, which does `JSON.parse(content) as LibraryExport` with no validation beyond a shallow `Array.isArray(data.books)` check on line 119. Every `Book` and `Summary` inside is then trusted as fully-formed and written straight into IndexedDB by `src/features/library/useLibrary.tsx:111` (`bookRepo.create({ ...book, profileId: profile.id })`). The type claims `books: Book[]` and `summaries: Summary[]` are non-optional and that each element has every required `Book` field; the runtime guarantees neither. The author evidently knew this: `useLibrary.tsx:109` and `:114` write `payload.books ?? []` and `payload.summaries ?? []` — nullish-coalescing fallbacks on two fields the type declares non-optional, which TypeScript considers unreachable dead code. That defensive `??` is the tell that the declared type and the real runtime shape have already diverged. Concrete failure: a hand-edited or truncated backup whose books lack `readingTimeMinutes` is written to the `books` store, then `src/components/StatsView.tsx:17` computes `finished.reduce((acc, b) => acc + b.readingTimeMinutes, 0)` and the whole total-reading-time stat becomes `NaN`, while `src/components/BookCard.tsx:95` renders the literal text `undefined min read`. The corruption is persistent — it survives reload because it went into IndexedDB. Correct behaviour: parse the file into `unknown` and run a real validator (a hand-written guard or a schema library) before anything reaches `bookRepo.create`, so `LibraryExport` is only ever obtained by proof rather than by assertion.

```
src/types.ts
 97 /** Shape of a library backup file. */
 98 export interface LibraryExport {
 99   version: 2;
100   exportedAt: string;
101   books: Book[];
102   summaries: Summary[];
103 }

src/features/library/useLibrary.tsx (the `??` on a non-optional field proves the type lies)
109       for (const book of payload.books ?? []) {
111         await bookRepo.create({ ...book, profileId: profile.id });
```

**Verification (confirmed).** Pattern present and unchanged. `LibraryExport` at src/types.ts:98-103 declares `books: Book[]` and `summaries: Summary[]` as required, fully-formed arrays. The only external producer is src/components/ProfileView.tsx:117 `const data = JSON.parse(content) as LibraryExport;`. The only guard is src/components/ProfileView.tsx:119 `if (!Array.isArray(data.books))` — a shallow array check on ONE of the two fields; `data.summaries` is never checked at all, and no element of either array is inspected. `data` then flows to `onImportLibrary(data)` (ProfileView.tsx:132) -> `importLibrary` (src/features/library/useLibrary.tsx:102-122), which writes elements straight into IndexedDB: `await bookRepo.create({ ...book, profileId: profile.id })` (useLibrary.tsx:111) and `await summaryRepo.upsert(summary)` (useLibrary.tsx:115). I read src/lib/storage/repo.ts:51-61 — `books.create` spreads the input, fills only `id` and `addedAt`, and calls `db.put('books', book)`. There is ZERO field validation anywhere on this path. The discoverer's `??`-tell is real and verified: useLibrary.tsx:109 `for (const book of payload.books ?? [])` and useLibrary.tsx:114 `for (const summary of payload.summaries ?? [])` are nullish fallbacks on two fields the declared type marks non-optional — unreachable by the type, which is the author admitting the type is a fiction. Both downstream consequences reproduce verbatim in current source: src/components/StatsView.tsx:17 `const totalTime = finished.reduce((acc, b) => acc + b.readingTimeMinutes, 0);` yields NaN if any finished book lacks the field, and src/components/BookCard.tsx:95 `<span>{book.readingTimeMinutes} min read</span>` renders the literal text 'undefined min read'. Because the bad record went through `db.put`, the corruption is durable across reloads. Severity `high` is correct per the spec — this is the codebase's only untrusted-file -> IndexedDB ingress, and the spec calls boundary-without-validation 'the most dangerous category'.

**Reachability.** Fully reachable, no gating. Profile page -> Data Management section -> 'Import Data' button (src/components/ProfileView.tsx:334-353) opens a file input with `accept=".json"` (ProfileView.tsx:327-333) wired to `handleImport` (ProfileView.tsx:109). Any user-supplied JSON file — hand-edited, truncated, from an older app version, or crafted — reaches `bookRepo.create` after passing only `Array.isArray(data.books)`. No API key required (the app is explicitly key-free for import/export), so this path is exercised by every user restoring a backup.

**Blast radius.** Type symbol `LibraryExport` has 6 references (src/types.ts:98, ProfileView.tsx:2/33/34/117, useLibrary.tsx:8/90/103). The real radius is the persisted data: every consumer of `Book` and `Summary` in the app inherits the unvalidated records — BookCard.tsx:89/95, StatsView.tsx:17/20/25, BookDetail.tsx:452/461/470, DailyWisdomModal.tsx:60, markdown.ts:22, prompts.ts:61/81. There is no test file for ProfileView (src/components/ has zero *.test.tsx), so nothing covers this ingress.

</details>

**Recommended fix.** Prove the shape at the point the file is read, before anything reaches storage.

*Feasibility: achievable*


#### F052 — The quiz question format lists every field as required, but nothing enforces that

**High** · `boundary-without-validation` · `src/types.ts`:105 · discovery (L02) · confidence: high

**What it is.** The shared definition of a quiz question says all four of its parts are always present. Its only source is an unchecked assumption about the AI's reply.

**Why it matters.** Every consumer, including the permanent review queue, relies on a guarantee that was never established. This is the type-level cause of the review-queue defects reported elsewhere.

<details><summary>Technical detail</summary>

`QuizQuestion` declares all four fields as required. Its only producer is `src/lib/ai/quiz.ts:16`: `const data = JSON.parse(response.text || '{}') as { questions?: QuizQuestion[] }` followed by `return data.questions ?? []` — raw Gemini output, asserted into the domain type with no per-element validation. A responseSchema is passed to the model (`src/lib/ai/schemas.ts:55-83`) but that is a generation hint, not an enforced contract, and it does not run on the client. The codebase already knows this rule and applied it correctly one file over: `src/lib/ai/schemas.ts:85-97` declares `RawBookResponse` with every field optional and the explicit comment 'Every field is optional because a model can always omit one, schema or not'. `QuizQuestion` is the same class of data and did not get the same treatment, so the two AI response types apply opposite discipline to identical risk. Concrete failure: the model omits `options` for one question, `data.questions` still passes the `?? []` guard, and `src/components/QuizModal.tsx:183` maps over `undefined` and throws a TypeError that takes down the quiz modal; if it instead omits `explanation`, the UI renders the string 'undefined' to the user. Correct behaviour: mirror `RawBookResponse` — declare a `RawQuizQuestion` with all fields optional, validate/normalise each element (drop malformed questions, backfill defaults) at the `quiz.ts` boundary, and only then hand out a `QuizQuestion` whose required fields are actually guaranteed.

```
src/types.ts
105 export interface QuizQuestion {
106   question: string;
107   options: string[];
108   correctAnswerIndex: number;
109   explanation: string;
110 }

src/lib/ai/quiz.ts (the only producer — an assertion over LLM JSON)
 16     const data = JSON.parse(response.text || '{}') as { questions?: QuizQuestion[] };
 17     return data.questions ?? [];
```

**Verification (amended).** Confirmed, and the blast radius is materially worse than described — amending the description, not the severity. Pattern verified verbatim: src/types.ts:105-110 declares all four `QuizQuestion` fields required; its sole producer src/lib/ai/quiz.ts:16-17 is `const data = JSON.parse(response.text || '{}') as { questions?: QuizQuestion[] }; return data.questions ?? [];` — a bare assertion over raw Gemini JSON with no per-element check. The QUIZ_SCHEMA at src/lib/ai/schemas.ts:55-83 does mark all four `required`, but it is a generation hint sent to the model, not a client-side validator, exactly as claimed. The in-house counter-example is real and verbatim: src/lib/ai/schemas.ts:85-97 defines `RawBookResponse` with every field optional under the comment 'Every field is optional because a model can always omit one, schema or not', and src/lib/ai/summarize.ts:34 shows the matching normalisation (`data.oneSentenceTakeaway || 'No takeaway available.'`). Two AI response types, opposite discipline, identical risk — confirmed. The render crash is real, at src/components/QuizModal.tsx:182 `{questions[currentQuestionIndex].options.map((option, idx) => {` (the discoverer cited 183; 183 is the `isCorrect` line — one-line drift). WHAT THE DISCOVERER MISSED, and why I am amending: the malformed question is PERSISTED to IndexedDB before/alongside the crash. QuizModal.tsx:50-62 loops every returned question and calls `reviewCards.upsert(newCard({ ..., options: question.options, correctAnswerIndex: question.correctAnswerIndex, explanation: question.explanation }))`. `newCard` (src/lib/srs.ts:22-36) copies `input.options` straight through into a `ReviewCard`, whose `options: string[]` (src/types.ts:88) is also declared required. So a question missing `options` becomes a stored review card with `options: undefined`, and src/features/review/ReviewPage.tsx:93 `{current.options.map((option, index) => {` then throws on every visit to the Review page — permanently, surviving reload, on a page that has nothing to do with quizzes. Note src/features/review/reviewQueue.test.tsx:149 exercises `options: []` but never `undefined`. Severity stays `high`: the ingress is the Gemini boundary and the damage is durable, but I am not promoting to critical because the responseSchema makes omission unlikely in practice and no observed malformed response is on record.

**Reachability.** Fully reachable. Book detail page -> 'Knowledge check' opens QuizModal, whose effect at QuizModal.tsx:41-71 calls `generateBookQuiz(book, summary)` on mount. Requires a Gemini key (AI-gated, per CLAUDE.md), and requires the model to drop a field despite the responseSchema. Once it happens, the review-page corruption needs no further AI call to keep firing.

**Blast radius.** `QuizQuestion` is referenced at src/types.ts:105, src/lib/ai/quiz.ts:6/16/8, src/components/QuizModal.tsx:4/33. But the persisted radius extends into the `reviewCards` store: QuizModal.tsx:52-61 -> src/lib/srs.ts:22-36 -> src/features/review/ReviewPage.tsx:93 and src/features/review/reviewQueue.ts. Neither QuizModal nor ReviewPage has a test that feeds a malformed question (src/components/ has zero test files).

</details>

**Recommended fix.** Add a separate all-optional shape for what the AI actually returns, and convert to the strict shape only after checking.

*Feasibility: achievable*


#### F107 — Nothing in the stored review card ties the answer position to the list of options

**High** · `boundary-without-validation` · `src/types.ts`:88 · discovery (L02) · confidence: high

**What it is.** A review card stores its answer choices and the index of the correct one as two unrelated values. There is no rule linking the index to the list it refers to.

**Why it matters.** Because the values come straight from the AI without checking, an out-of-range index is stored permanently and makes that card impossible to answer correctly and impossible to remove.

<details><summary>Technical detail</summary>

ReviewCard.correctAnswerIndex (types.ts:89) has no type-level relation to ReviewCard.options (types.ts:88), and the value arrives unvalidated from Gemini — schemas.ts:69-72 expresses the 0-3 range only as prose, quiz.ts:16 casts JSON.parse output straight to QuizQuestion[], srs.ts:29 copies it verbatim, and QuizModal.tsx:52 persists the card to IndexedDB. An out-of-range index makes the card permanently unanswerable at ReviewPage.tsx:76/94, and because a wrong answer grades 1 the SM-2 scheduler (srs.ts:45-46) resets the interval to one day, so the corrupt card resurfaces every day until the book is deleted. Unvalidated AI ingress plus durable persistence puts this at high.

```
src/types.ts
 86   question: string;
 87   options: string[];
 88   correctAnswerIndex: number;
 89   explanation: string;

src/lib/srs.ts (copied through with no bounds check, then persisted)
 28     options: input.options,
 29     correctAnswerIndex: input.correctAnswerIndex,

src/features/review/ReviewPage.tsx
 76   const isCorrect = selected === current.correctAnswerIndex;
```

**Verification (amended).** Confirmed end to end and promoted. types.ts:88-89 places `options: string[]` and `correctAnswerIndex: number` side by side with no expressed relation. The value's origin is Gemini: schemas.ts:69-72 constrains it only with the natural-language description 'Index (0-3) of the correct answer in the options array' (and options only with 'Array of 4 possible answers.'), and quiz.ts:16 takes it off a raw `JSON.parse(response.text || '{}') as { questions?: QuizQuestion[] }` cast. QuizModal.tsx:50-61 then feeds each question straight into srs.ts:22-35 newCard, which copies correctAnswerIndex verbatim at srs.ts:29, and QuizModal.tsx:52 persists the card with reviewCards.upsert. There is no bounds check on any of those five hops. Consumers compare for equality: ReviewPage.tsx:76 `selected === current.correctAnswerIndex` and :94 `index === current.correctAnswerIndex`, plus QuizModal.tsx:78. This satisfies the spec's High bar on two counts — a known-runtime-data ingress with no validation, and durability: the bad index is written to IndexedDB, and because a wrong answer grades 1, scheduleCard (srs.ts:45-46) resets intervalDays to 1, so the unanswerable card returns every single day, permanently.

**Reachability.** Take a quiz on any book with a Gemini key. A model that returns 1-based indices (a classic structured-output failure the schema's prose description does not prevent) yields correctAnswerIndex 4 on a 4-element options array: every option renders un-highlighted, ReviewPage.tsx:76 is false for every choice, the card can never be answered correctly, and it resurfaces daily forever. Only deleting the book (books.remove -> reviewCards.removeByBook, repo.ts:72) clears it.

**Blast radius.** One ingress (quiz.ts:16) feeding one writer (QuizModal.tsx:52-61 via srs.ts:29) and three consumer sites (ReviewPage.tsx:76, ReviewPage.tsx:94, QuizModal.tsx:78). Every review card in the database originates here.

</details>

**Recommended fix.** Validate the pair together where the AI output becomes stored data, and consider keeping the correct answer's text rather than its position.

*Feasibility: achievable · Severity amended from medium → high during verification*


### 2.3 Medium

64 findings.

- **F053** · `eslint.config.js`:17 · `tsconfig-strictness-gap`
  **The rule that bans 'trust me' overrides is not switched on**
  The linter rule that flags forced non-null overrides is not part of the enabled rule set, and nothing else prevents new ones from being added.
  *Fix:* Enable the rule as a warning now and as an error once the existing sites are cleaned up. — Feasibility: achievable
- **F054** · `src/app/ErrorBoundary.tsx`:6 · `discriminated-union-opportunity`
  **The error screen only recognises one of the two kinds of error the router can hand it**
  The error screen narrows the failure by checking whether it is a standard error object. The router's not-found responses are not one, so they fall through to the generic branch.
  *Fix:* Use the router's own check for a response-shaped error and add the missing branch. — Feasibility: achievable
- **F055** · `src/app/routes.tsx`:12 · `untyped-public-function`
  **The route table has no declared type, which switches off typo checking for the whole route tree**
  The list of routes is exported without stating what it is, so the compiler stops checking that its property names are real.
  *Fix:* Add the route-array type annotation; it is one line and immediately restores typo checking. — Feasibility: achievable
- **F001** · `src/app/routing.test.tsx`:47 · `non-null-assertion`
  **The routing test walks up to the crash on unsummarised books and stops one click short**
  The only test that drives a real book page through the router uses a book with no summary, then checks the address bar instead of what the page offers.
  *Fix:* Extend that test to assert that a book without a summary does not offer the summary-dependent controls. — Feasibility: achievable
- **F010** · `src/app/routing.test.tsx`:94 · `unknown-misuse`
  **No test visits an unknown address, so all page-not-found errors show a generic message**
  The error screen only recognises one of the two kinds of failure the router can deliver. Every test that touches it uses an address the router does match.
  *Fix:* Use the router's own check to recognise a not-found response, add the missing branch, and add the test that visits an unmatched address. — Feasibility: achievable
- **F056** · `src/app/ShellContext.ts`:9 · `unknown-misuse`
  **The shared error handler promises to work on anything but throws on an empty failure**
  The app-wide error handler accepts any thrown value by contract, but the classification underneath it assumes an object.
  *Fix:* Add the guard once at the source rather than at every call site. — Feasibility: achievable
- **RT-F203** · `src/components/AddBookModal.tsx`:74 · `discriminated-union-opportunity`
  **Books you have not read are saved with a rating of four stars that you never gave**
  The add-book form knows that ratings only apply to finished books, because it hides the rating control otherwise. It still saves the control's default value for every book regardless.
  *Fix:* Apply the same status check to the rating that is already applied to the priority, so an unread book carries no fabricated score.
- **RT-F012** · `src/components/AudioPlayer.tsx`:50 · `untyped-public-function`
  **The audio player shows Pause when nothing is actually playing**
  Pressing play flips the button to Pause without waiting to see whether playback actually started. The result of the attempt is discarded, even though the same call is handled properly twenty lines above.
  *Fix:* Set the playing state from the outcome of the attempt rather than from the intention.
- **F059** · `src/components/BookDetail.tsx`:452 · `discriminated-union-opportunity`
  **The book page and the library card read two different copies of the same sentence**
  The one-sentence takeaway is stored twice: once on the summary and once copied onto the book. Nothing keeps the two in step.
  *Fix:* Fix the missing copy first, then decide whether the duplicate field is worth keeping at all. — Feasibility: requires-design
- **RT-F204** · `src/components/ChatModal.tsx`:73 · `discriminated-union-opportunity`
  **A chat failure is displayed as though the assistant said it, or is dropped entirely**
  The chat message format has only two kinds, user and assistant, with no way to represent a failure. An error is therefore written into an assistant message.
  *Fix:* Add a failure variant to the message type and render it distinctly, so errors are never mistaken for answers.
- **F013** · `src/components/EReader.tsx`:395 · `tsconfig-strictness-gap`
  **The reader can crash on a deep dive that is only whitespace**
  The reader assumes its page list is never empty. A deep dive made only of blank lines produces an empty list, and the reader then tries to render a page that does not exist.
  *Fix:* Make the fallback guarantee real by returning the placeholder page when the split produces nothing. — Feasibility: achievable
- **RT-F006** · `src/components/EReader.tsx`:182 · `tsconfig-strictness-gap`
  **A whitespace-only deep dive produces an empty reader that crashes on open**
  The reader builds its page list and falls back to a placeholder only when the text is entirely missing. Text made only of blank lines passes that check and then produces no pages at all.
  *Fix:* Apply the placeholder fallback after the pages are built, not before, so the non-empty guarantee is real.
- **F017** · `src/components/QuizModal.tsx`:183 · `boundary-without-validation`
  **The quiz screen uses the answer position as a list index with nothing guaranteeing it fits**
  The quiz reads the answer choices by position using a number that has never been checked against the size of the list.
  *Fix:* No separate change is needed here; validating the AI output where it is produced fixes this site too. — Feasibility: achievable
- **F061** · `src/components/StatsView.tsx`:20 · `discriminated-union-opportunity`
  **A rating of zero means 'unrated', so the average rating statistic is wrong after any import**
  Book ratings use zero to mean 'not rated', but the statistics screen averages every book including those zeros.
  *Fix:* Make 'unrated' an absent value rather than a zero, and exclude unrated books from the average. — Feasibility: requires-design
- **F063** · `src/components/ui/useFocusTrap.ts`:18 · `type-assertion-as-T`
  **The shared focus trap assumes every match is a focusable element**
  The focus trap collects elements by a text pattern and assumes each result can receive focus, without checking.
  *Fix:* Filter the collected matches to real focusable elements instead of assuming, and exclude hidden inputs. — Feasibility: achievable
- **RT-F202** · `src/features/book/useBookRoute.ts`:13 · `discriminated-union-opportunity`
  **Moving directly between two books briefly shows the previous book's summary**
  The book and its summary are loaded by two different mechanisms, one immediate and one delayed. Navigating from one book to another swaps the book instantly while the summary lags behind.
  *Fix:* Load the pair as a single value tagged with the book it belongs to, so a mismatched combination cannot be rendered.
- **F018** · `src/features/library/goodreadsImport.test.tsx`:9 · `boundary-without-validation`
  **The only import test uses a perfect Goodreads header, so foreign spreadsheets are untested**
  Every import test feeds the parser exactly the file layout it was designed for. No test uses a spreadsheet from a different service.
  *Fix:* Add a table-driven case with a foreign header row alongside the existing header tests. — Feasibility: achievable
- **F067** · `src/features/library/LibraryPage.tsx`:35 · `boundary-without-validation`
  **Cached recommendations are read back from browser storage and rendered without checking**
  The recommendation cache is read from local storage and assumed to have the expected shape. Nothing verifies it before it is displayed.
  *Fix:* Check the cached value's shape next to where it is read, and discard the cache when it does not match. — Feasibility: achievable
- **F068** · `src/features/library/LibraryPage.tsx`:188 · `discriminated-union-opportunity`
  **The library shows its 'no books' message during the initial load**
  The library page never reads the loading flag that sits right next to the book list, so an empty list is treated as final.
  *Fix:* Read the loading flag and render a loading state before the empty state. — Feasibility: achievable
- **F020** · `src/features/library/useLibrary.test.tsx`:11 · `discriminated-union-opportunity`
  **Tests always wait for loading to finish, so the false 'empty library' flash is invisible**
  The library's loading flag is only ever used to wait, never asserted. No test observes what the screen renders before the data arrives.
  *Fix:* Assert the loading state explicitly, and give the library page a loading branch as the book pages already have. — Feasibility: requires-design
- **F021** · `src/features/library/useLibrary.test.tsx`:84 · `discriminated-union-opportunity`
  **The routine that saves a summary has no tests, and the one summary test skips the fields that break**
  Nothing exercises the save-summary path, and the single summary test checks only the summary record, never the copied-across fields on the book.
  *Fix:* Fix the missing field where books are created, then add the assertions that would have caught it. — Feasibility: achievable
- **F023** · `src/features/library/useLibrary.tsx`:170 · `discriminated-union-opportunity`
  **The library hook cannot distinguish 'no books' from 'not loaded yet'**
  The library returns a list of books and a separate loading flag as two unrelated values, so an empty list looks authoritative even before anything has been read.
  *Fix:* Give the pages that render an empty list a loading branch first, then consider returning one tagged value instead of two independent ones. — Feasibility: requires-design
- **F069** · `src/features/library/useLibrary.tsx`:185 · `untyped-public-function`
  **The library feature has no written contract; its public shape is whatever the code happens to return**
  The library's public interface is derived automatically from the implementation rather than declared, so the implementation cannot disagree with it.
  *Fix:* Declare the interface explicitly and annotate the implementation against it. — Feasibility: achievable
- **RT-F201** · `src/features/library/useLibrary.tsx`:48 · `branded-type-opportunity`
  **One place creates a book identifier and a summary identifier together, and swapping them would go unnoticed**
  All record identifiers are plain text. In the routine that adds a book, both a new book identifier and a new summary identifier are in scope at once and are interchangeable to the compiler.
  *Fix:* Give the two identifier kinds distinct types at the single place they are created, which keeps the change small.
- **F070** · `src/features/profile/ProfileContext.test.tsx`:16 · `non-null-assertion`
  **A test helper forces an assumption that two of the file's own tests break**
  A test button reaches for the first profile and overrides the compiler's warning that there might not be one. Two tests in the same file run with no profiles at all.
  *Fix:* Check for the profile before using it, so the helper is safe in every state the file already creates. — Feasibility: achievable
- **F071** · `src/features/profile/ProfileContext.tsx`:10 · `discriminated-union-opportunity`
  **The profile context lets code act on a missing profile while loading is still in progress**
  The profile and the loading flag are exposed as two unrelated values, so the three real states are encoded as four possible combinations.
  *Fix:* Expose a tagged state alongside the existing fields so consumers can be migrated gradually. — Feasibility: requires-design
- **F025** · `src/features/review/reviewQueue.test.tsx`:144 · `boundary-without-validation`
  **The one test card with no answer options is built only to be deleted, never to be reviewed**
  Every card the review tests create has a full set of options. The single card without them exists inside a deletion test that never opens the queue.
  *Fix:* Add a test that puts a card with no options into the queue and asserts the session can still move past it. — Feasibility: achievable
- **F074** · `src/features/review/useReviewQueue.ts`:46 · `untyped-public-function`
  **The review queue reports a definite current card when there may be none**
  The review queue's public shape is inferred rather than declared, and the inference says the current card always exists because a compiler option that would say otherwise is switched off.
  *Fix:* Declare the interface explicitly with the current card marked as possibly absent. — Feasibility: achievable
- **F026** · `src/lib/ai/apiKey.test.ts`:1 · `boundary-without-validation`
  **Nine of the eleven AI modules have no tests at all, including every place AI output is trusted**
  The AI folder ships eleven modules and two test files. Every point where a model reply is converted into app data sits in the untested nine.
  *Fix:* Add one table-driven test file per conversion point, starting with the quiz path where the consequences are permanent. — Feasibility: achievable
- **F076** · `src/lib/ai/chat.ts`:35 · `discriminated-union-opportunity`
  **A blocked chat reply arrives as an empty message bubble with no explanation**
  The chat stream converts a missing reply into an empty string, and an empty string is indistinguishable from a valid one at the point it is used.
  *Fix:* Treat an entirely empty stream as a failure so the existing error handling can report it. — Feasibility: achievable
- **F027** · `src/lib/ai/errors.test.ts`:4 · `boundary-without-validation`
  **The AI error tests use a placeholder message, so they pass without proving anything**
  Every test error is built with the message 'boom', which matches none of the classification rules being tested. The tests therefore exercise a path the real service never produces.
  *Fix:* Make the fixture reproduce the real message shape the service sends, then add the case that fails today. — Feasibility: achievable
- **F077** · `src/lib/ai/errors.test.ts`:4 · `type-assertion-as-T`
  **No error test ever passes something that is not an error object**
  Every failure fixture in the error tests builds a real error. The empty and non-object cases, which are the ones that throw, are never tried.
  *Fix:* Add the guard at the source and add fixtures covering the empty and non-object cases. — Feasibility: achievable
- **F028** · `src/lib/ai/errors.ts`:40 · `type-assertion-as-T`
  **Error handling itself throws when the thing being reported is empty**
  The routine that inspects a caught failure assumes it is always an object and immediately reads a property from it. Nothing checks first.
  *Fix:* Confirm the value is a non-empty object before reading from it — a one-line guard with no behaviour change for anything currently reachable. — Feasibility: achievable
- **F032** · `src/lib/ai/schemas.ts`:69 · `boundary-without-validation`
  **The quiz template permits ungradeable quizzes, and the range rule lives only in prose**
  The template that constrains the AI's quiz output leaves the number of options unbounded and states the valid answer range only in an English description, which is a hint rather than a rule.
  *Fix:* Use the template's own numeric and item-count constraints instead of describing them in prose. — Feasibility: achievable
- **F079** · `src/lib/ai/schemas.ts`:8 · `boundary-without-validation`
  **A book's category is unconstrained everywhere except in the prompt's wording**
  Three layers describe categories differently: the AI template allows any text, the app type allows any text, and the permitted list exists only as prose in the prompt.
  *Fix:* Put the permitted list into the AI template as an enumeration and reuse the same list in the app. — Feasibility: achievable
- **F080** · `src/lib/ai/schemas.ts`:18 · `boundary-without-validation`
  **Rating and reading-time ranges are stated only in prose, then stored unchecked**
  The AI template describes the valid ranges for rating and reading time in an English description rather than as numeric limits, even though the template supports real limits.
  *Fix:* Use the template's numeric limits and clamp the values when converting the reply. — Feasibility: achievable
- **F033** · `src/lib/ai/summarize.ts`:36 · `boundary-without-validation`
  **Summary fields are defaulted in a way that lets wrong-typed AI values through**
  When converting the AI's reply, missing lists are replaced with empty ones. That mechanism only substitutes for absent values; a value of the wrong kind is passed along untouched.
  *Fix:* Check the shape rather than just the presence of each field before it is stored. — Feasibility: achievable
- **RT-F010** · `src/lib/ai/summarize.ts`:22 · `boundary-without-validation`
  **Wrong-typed AI fields are converted into a finished book and stored as real**
  The conversion from an AI reply into a stored book promises complete lists and real numbers. Its defaults only fill in fields that are entirely absent; a field of the wrong kind passes through untouched.
  *Fix:* Coerce each field by checking its shape rather than only its presence, so the promised type is true by construction.
- **F081** · `src/lib/ai/tts.ts`:27 · `boundary-without-validation`
  **The audio format the service reports is discarded and a fixed one is assumed instead**
  When speech audio comes back, the app takes the bytes and ignores the format label sitting next to them, then stamps on a hard-coded format header.
  *Fix:* Read the reported format and refuse to build a file when it is not the expected one. — Feasibility: achievable
- **F036** · `src/lib/base64.test.ts`:4 · `boundary-without-validation`
  **The encoding tests only cover inputs the tests themselves produced**
  The two tests for the encoding helpers use only well-formed data they generated. Invalid input, empty input and prefixed input are never tried.
  *Fix:* Write the tests against the corrected contract where the decoder can report failure, covering invalid and empty input. — Feasibility: achievable
- **F085** · `src/lib/covers/googleBooks.ts`:12 · `boundary-without-validation`
  **The Google Books cover response is assumed to have the expected shape**
  The reply from the cover-lookup service is treated as the shape the app wants without any checking, because the browser's own network types provide no guarantees.
  *Fix:* Read the response as unknown and narrow it step by step to the two fields actually used. — Feasibility: achievable
- **F086** · `src/lib/covers/openLibrary.ts`:6 · `boundary-without-validation`
  **The OpenLibrary cover response is assumed to have the expected shape**
  The reply from the second cover service is likewise treated as the expected shape with no checking.
  *Fix:* Narrow the response instead of assuming it, and fall back to the placeholder when the shape does not match. — Feasibility: achievable
- **F089** · `src/lib/goodreads.ts`:96 · `tsconfig-strictness-gap`
  **The CSV parser's own safety checks are invisible to the compiler**
  Because one compiler option is switched off, every row and column read in the parser is described as definitely present even where the author added runtime checks for the opposite.
  *Fix:* Enable the option and close the ten measured sites; none of them are in the core library code. — Feasibility: achievable
- **F090** · `src/lib/goodreads.ts`:104 · `boundary-without-validation`
  **A spreadsheet rating is converted to a number and stored with no upper or lower bound**
  The rating column is converted from text to a number and stored without confirming it falls within the one-to-five range the rest of the app assumes.
  *Fix:* Clamp the value to the valid range where it is parsed. — Feasibility: achievable
- **RT-F008** · `src/lib/goodreads.ts`:109 · `discriminated-union-opportunity`
  **Imported books with no author or rating are given fake values that the statistics treat as real**
  The spreadsheet parser substitutes the literal word 'Unknown' for a blank author and zero for a missing rating, and both are stored as though they were genuine data.
  *Fix:* Make absence representable — leave the rating unset rather than zero — and exclude unset ratings from the average.
- **F006** · `src/lib/storage/migrate.test.ts`:8 · `boundary-without-validation`
  **Every upgrade test uses perfectly-formed old data, so a startup-hanging failure passes green**
  The tests for the upgrade from the previous version always seed flawless, correctly-shaped leftover data. Nothing damaged is ever tried.
  *Fix:* Add negative fixtures with damaged leftover data, and land them in the same change as the guards they are meant to prove. — Feasibility: achievable
- **F041** · `src/lib/storage/migrate.test.ts`:96 · `discriminated-union-opportunity`
  **The migration test checks the summary link but not the headline that must travel with it**
  The test that verifies old books are split correctly checks several fields, but not the short headline that list views need, even though the fixture contains one.
  *Fix:* Add the missing assertion; it should fail today and pass once the migration is fixed. — Feasibility: achievable
- **F042** · `src/lib/storage/migrate.ts`:94 · `boundary-without-validation`
  **Old profile data borrows the current app's strict field types without checking the values**
  The upgrade describes leftover profile data using the current app's restricted value lists, but that data was never validated against them.
  *Fix:* Move the permitted value lists somewhere shared, then check the old values against them before storing. — Feasibility: achievable
- **F096** · `src/lib/storage/migrate.ts`:127 · `boundary-without-validation`
  **Old insight lists are defaulted in a way that lets non-list values through**
  The upgrade replaces missing insight and step lists with empty ones, but that only handles values that are entirely absent, not values of the wrong kind.
  *Fix:* Build the lists by filtering for text rather than by substituting for absence. — Feasibility: achievable
- **F097** · `src/lib/storage/migrate.ts`:136 · `boundary-without-validation`
  **Attachment data from the old app is passed to the decoder on the strength of a declaration alone**
  The attachment fields are declared as text but originate from unchecked leftover storage. The truthiness checks before decoding catch blanks, not wrong types.
  *Fix:* Check the value is text before decoding, and skip the attachment rather than aborting the upgrade. — Feasibility: achievable
- **RT-F305** · `src/lib/storage/migrate.ts`:54 · `type-assertion-as-T`
  **One generic helper manufactures a trusted type for every leftover-data read at once**
  A single small helper reads leftover browser storage and hands the result back as whatever type the caller asked for, with no checking. It is the only such site in the upgrade code.
  *Fix:* Have the helper return an unknown value and make each caller prove the shape it needs.
- **F045** · `src/lib/storage/repo.test.ts`:13 · `boundary-without-validation`
  **No storage test can produce an oversized record, so the 'no binary data' rule is unguarded**
  The test helper for creating books is typed so that it cannot express a record carrying extra fields. The real risk shape is therefore untestable.
  *Fix:* Add a test that feeds the real ingress shape rather than widening the helper's type. — Feasibility: achievable
- **F046** · `src/lib/storage/repo.ts`:8 · `boundary-without-validation`
  **Profiles read from the database are sorted using a text operation on an unchecked field**
  The profile list is sorted by calling a text method on a stored timestamp that nothing has verified is text.
  *Fix:* Check the field is text at the read boundary and fall back to a safe ordering when it is not. — Feasibility: achievable
- **F047** · `src/lib/storage/repo.ts`:44 · `boundary-without-validation`
  **Books read from the database are assumed valid, then used directly in arithmetic**
  The book list comes back described exactly as the app's book type, but the database performs no checking of its own. Numeric fields are then added up and dates parsed without inspection.
  *Fix:* Fix this once on the write side, and add a cheap read-side check in the same change. — Feasibility: requires-design
- **F049** · `src/lib/storage/repo.ts`:143 · `boundary-without-validation`
  **A stored attachment is rebuilt into a file without checking it is really file data**
  Reading an attachment reconstructs it from the stored bytes and type with no verification. The browser's file constructor does not reject bad input; it silently converts it to text.
  *Fix:* Make the failure loud rather than producing a plausible-looking corrupt file. — Feasibility: achievable
- **F113** · `src/lib/storage/repo.ts`:113 · `boundary-without-validation`
  **A summary fetched by index is trusted completely, including its list fields**
  Looking up a summary by book returns something described as a complete summary. The database performs no checking, and the list fields are used directly.
  *Fix:* Add a check next to the store and use it at the read boundary. — Feasibility: achievable
- **F114** · `src/lib/storage/repo.ts`:138 · `boundary-without-validation`
  **The stored file type is free-form text and is replayed straight back into the browser**
  When an attachment is saved, whatever type the browser reported is stored verbatim, and reading it back reuses that text to reconstruct the file.
  *Fix:* Derive the type from the attachment kind instead of storing whatever arrived. — Feasibility: achievable
- **RT-F107** · `src/lib/storage/repo.ts`:4 · `boundary-without-validation`
  **Every identifier in the app depends on a browser feature that is not always available**
  New records get their identifiers from a browser function that the compiler treats as always present. It is only available on secure origins.
  *Fix:* Route all identifier creation through one small helper with a fallback for when the browser feature is unavailable. — Effort: moderate
- **F103** · `src/types.ts`:24 · `boundary-without-validation`
  **Timestamps are plain text whose exact format silently drives sorting**
  Dates across the app are stored as plain text, and two parts of the storage layer depend on that text having a specific format in order to sort correctly. One of those timestamps comes from unchecked leftover storage.
  *Fix:* Validate the timestamp at the one place it enters from outside, and make the two sort routines agree on one comparison method. — Feasibility: achievable
- **F106** · `src/types.ts`:51 · `discriminated-union-opportunity`
  **Whether a book has an attached PDF is recorded separately from the PDF itself**
  A book carries a flag saying it has a PDF, and the actual bytes live elsewhere. The two are supplied independently and never reconciled.
  *Fix:* Derive the flag from whether the file was actually stored, rather than accepting it as a separate input. — Feasibility: achievable
- **F108** · `src/types.ts`:99 · `boundary-without-validation`
  **The backup format has a version number that nothing ever reads**
  Backup files carry a version tag intended to distinguish formats, but the restore path never looks at it.
  *Fix:* Read the version first and route older files to a converter or a clear refusal. — Feasibility: achievable
- **F109** · `tsconfig.json`:8 · `tsconfig-strictness-gap`
  **Array and lookup reads are described as always succeeding, at ten real sites**
  One compiler option that would flag reads which can come back empty is switched off, so ten places are described as definitely producing a value when they may not.
  *Fix:* Turn the option on and fix the ten measured sites. None of them are in the core library code, which measures completely clean. — Feasibility: achievable
- **F110** · `tsconfig.json`:8 · `tsconfig-strictness-gap`
  **Optional fields can be explicitly set to 'nothing', which behaves differently once stored**
  One compiler option is off, so a field marked optional can be written with an explicit empty value rather than being left out entirely.
  *Fix:* Fix the nine producing sites so optional fields are omitted rather than explicitly emptied, then enable the option. — Feasibility: achievable
- **F111** · `tsconfig.json`:8 · `tsconfig-strictness-gap`
  **A loose lookup type on the cover service hides that its fallback chain is the normal path**
  The cover response's image links are described as a lookup that always succeeds for any key, which makes the fallback chain look unreachable to the compiler when it is in fact the common case.
  *Fix:* Describe the image links as a small set of optional named fields; that removes all five reported sites without needing the compiler option at all. — Feasibility: achievable

### 2.4 Low

61 findings.

- **F115** · `src/app/AppShell.tsx`:70 · `tsconfig-strictness-gap`
  **A random book pick is described as always succeeding, and the author's own guard looks redundant**
  Choosing a random book from a list is described as always producing one, so the check the author wrote for the empty case appears unnecessary to the compiler.
  *Fix:* No change needed here; enabling the compiler option makes the existing guard visibly necessary. — Feasibility: achievable
- **F116** · `src/app/routes.tsx`:19 · `branded-type-opportunity`
  **Route addresses are written out separately in every place they are used**
  Each route path is an independently written piece of text with no connection between where it is defined and where it is navigated to.
  *Fix:* Define the path segments once and build both the routes and the navigation targets from them. — Feasibility: achievable
- **F057** · `src/components/AddBookModal.tsx`:42 · `type-assertion-as-T`
  **A file read result is assumed to be text and then split without a bounds check**
  The PDF upload handler assumes the file reader produced text, when it can also produce raw bytes or nothing, and then indexes into the split result without checking.
  *Fix:* Narrow the result by checking it rather than asserting it, so the type follows the method used. — Feasibility: achievable
- **F058** · `src/components/AddBookModal.tsx`:91 · `boundary-without-validation`
  **A file is accepted as a PDF on the browser's word alone, and the advertised size limit is never applied**
  The upload screen displays a ten-megabyte limit and never enforces it, and it decides a file is a PDF purely from the label the browser attached.
  *Fix:* Enforce the advertised size limit where the file is selected, and check the file's actual leading bytes. — Feasibility: achievable
- **RT-F108** · `src/components/AddBookModal.tsx`:174 · `type-assertion-as-T`
  **A dropdown's raw text value is assumed to be one of three valid priorities**
  The priority dropdown's selected text is assumed to be one of the three valid priority values. The option list is written out separately just below and nothing links the two.
  *Fix:* Build the option list from the priority definition instead of asserting toward it. — Effort: trivial
- **F148** · `src/components/AudioPlayer.tsx`:64 · `js-implicit-coercion`
  **An unknown audio duration is treated as a real one and produces a meaningless scrubber**
  The audio duration is stored as a plain number that can be unknown or infinite, and the player then both formats it and tests it for truthiness.
  *Fix:* Convert an unknown duration to a defined value where it is read, and test for that explicitly. — Feasibility: achievable
- **RT-F306** · `src/components/AudioPlayer.tsx`:29 · `implicit-any-from-missing-annotation`
  **A standard library callback silently receives an untyped value, defeating the project's zero-any property**
  The rejection handler on a playback attempt gets its value typed as unrestricted by TypeScript's own standard library declarations, without any explicit unrestricted type appearing in this project's code.
  *Fix:* Annotate the callback's parameter as unknown, which is the correct type here because a rejection genuinely can be anything.
- **F117** · `src/components/BookDetail.tsx`:71 · `tsconfig-strictness-gap`
  **Several text-parsing reads are described as always succeeding in the book detail view**
  Pattern-match results and split fragments are described as definitely present, when the underlying operations can produce nothing.
  *Fix:* Destructure the match once and handle the absent case, which fixes all three real sites at once. — Feasibility: achievable
- **F118** · `src/components/BookDetail.tsx`:199 · `branded-type-opportunity`
  **A stored file type is carried into a browser window with no check**
  The type recorded when an attachment was uploaded is whatever the browser said at the time, and it is used unchecked when opening the file in a new tab.
  *Fix:* Derive the type from the attachment kind at the storage layer, which fixes this site and the storage one together. — Feasibility: achievable
- **F119** · `src/components/DailyWisdomModal.tsx`:71 · `branded-type-opportunity`
  **A missing cover is signalled by special text values that only one screen knows about**
  The cover address field uses an empty value and a literal placeholder word to mean 'no cover'. Only the library card knows about both.
  *Fix:* Extract the normalisation into one shared helper and use it everywhere a cover is displayed. — Feasibility: achievable
- **F060** · `src/components/ProfileView.tsx`:116 · `type-assertion-as-T`
  **The backup file read assumes text and ignores three other possible outcomes**
  Reading the chosen backup file assumes the result is text, when it can also be raw bytes, nothing, or an outright failure. No failure handler is attached.
  *Fix:* Check the result before using it and add the missing failure handler. — Feasibility: achievable
- **F120** · `src/components/ProfileView.tsx`:53 · `branded-type-opportunity`
  **A monthly reading goal of zero produces an invalid progress ring**
  The monthly goal is a plain number with no lower bound, and progress is calculated by dividing by it.
  *Fix:* Sanitise the goal where the profile is written so an invalid value never persists. — Feasibility: achievable
- **F121** · `src/components/StatsView.tsx`:23 · `tsconfig-strictness-gap`
  **A category tally is described as having every key already present**
  The tally used for the category chart is described as a lookup that always yields a number, so the first read for a new category looks safe when it actually produces nothing.
  *Fix:* Use a real map so a missing key is honest, without waiting on the compiler option. — Feasibility: achievable
- **F062** · `src/components/ui/ConfirmDialog.tsx`:19 · `discriminated-union-opportunity`
  **The confirmation dialog can leave a caller waiting forever**
  The dialog keeps its pending question and its pending answer in two separate slots that are not linked. Asking a second question while one is open discards the first answer without resolving it.
  *Fix:* Collapse the two slots into a single tagged state so an open dialog always has exactly one waiting caller. — Feasibility: achievable
- **F123** · `src/components/ui/Dialog.tsx`:12 · `branded-type-opportunity`
  **The dialog's size setting accepts any text when only three values work**
  The shared dialog takes its width as free-form text, but only a handful of specific style class names have any effect.
  *Fix:* Restrict the setting to the three values that actually work; both current uses already qualify. — Feasibility: achievable
- **F124** · `src/components/ui/toastStore.test.ts`:25 · `non-null-assertion`
  **Toast tests use overrides that are currently unnecessary and would hide a real check later**
  Several test assertions force past a warning the compiler is not currently issuing, so they do nothing today.
  *Fix:* Assert the precondition explicitly instead of suppressing the warning. — Feasibility: achievable
- **F126** · `src/components/ui/useFocusTrap.ts`:25 · `type-assertion-as-T`
  **The currently-focused element is assumed to be one that can receive focus**
  The focus trap records whatever element had focus and assumes it supports being focused again, which the general element type does not.
  *Fix:* Drop the assumption and check the element's kind before calling focus on it. — Feasibility: achievable
- **RT-F307** · `src/components/ui/useFocusTrap.ts`:47 · `non-null-assertion`
  **Three overrides do nothing today and would silence a useful check tomorrow**
  Three places force past warnings that the compiler is not currently issuing. Removing all three was proven to compile cleanly under the project's exact settings.
  *Fix:* Delete the three overrides now, while they are provably doing nothing.
- **F064** · `src/features/library/goodreadsImport.test.tsx`:55 · `non-null-assertion`
  **An import assertion is written so that it can never fail on its own**
  Two import assertions reach through an optional value, which makes them pass trivially if the value is absent. The preceding assertion happens to cover that case.
  *Fix:* Fold the checks into the existing assertion or assert the value is present first. — Feasibility: achievable
- **F066** · `src/features/library/GoodreadsImport.tsx`:15 · `discriminated-union-opportunity`
  **A failed file pick can import the rows from the previously chosen file**
  The import screen tracks the filename, the parsed preview and the error as three unrelated values, so a failed parse can leave the previous preview in place.
  *Fix:* Replace the three separate values with one state that can only be in one phase at a time. — Feasibility: achievable
- **F128** · `src/features/library/LibraryPage.tsx`:22 · `discriminated-union-opportunity`
  **The 'All' filter shares its value space with real, AI-generated category names**
  The library's category filter uses the word 'All' as a sentinel in the same field that holds real categories, and categories themselves are unconstrained text produced by the AI.
  *Fix:* Represent 'no filter' as an absent value rather than as a reserved word. — Feasibility: achievable
- **F129** · `src/features/library/LibraryPage.tsx`:56 · `weak-type-as-Object-or-Function`
  **A priority score table is keyed by any text instead of the three real priorities**
  The lookup that converts a priority into a sort score accepts any text as a key rather than the three defined priority values.
  *Fix:* Key the table by the priority type so it must stay exhaustive. — Feasibility: achievable
- **F130** · `src/features/library/RecommendationCarousel.tsx`:12 · `branded-type-opportunity`
  **A recommendation's title doubles as its identity**
  The recommendation carousel uses the book's title both as its list identity and as the marker for which item is being added.
  *Fix:* Track the item's position rather than its text. — Feasibility: achievable
- **F131** · `src/features/library/useLibrary.tsx`:128 · `discriminated-union-opportunity`
  **Three library actions handle 'no profile selected' three different ways, and two report success**
  The add, import and save routines each deal with a missing profile differently; two of them return a result that looks like a successful no-op.
  *Fix:* Make the precondition part of the contract so the situation cannot be silently swallowed. — Feasibility: achievable
- **F073** · `src/features/review/reviewQueue.test.tsx`:10 · `untyped-public-function`
  **The review-queue test inherits a contract that overstates what the hook returns**
  The test harness picks up the queue's inferred shape, in which the current card is always present, and the file's own code defends against it being absent anyway.
  *Fix:* No separate change; once the queue declares the card as possibly absent, the tests already read correctly. — Feasibility: achievable
- **F075** · `src/features/settings/useTheme.test.tsx`:26 · `unknown-misuse`
  **The theme test's fake browser API is unchecked and cannot actually fire a change**
  The stub used to fake the operating-system theme query is installed through a helper that accepts anything, so nothing checks it resembles the real thing, and its listener is recorded but never invoked.
  *Fix:* Type the stub against the real interface and keep a reference to the listener so the test can trigger a change. — Feasibility: achievable
- **F132** · `src/features/settings/useTheme.test.tsx`:15 · `generic-opportunity`
  **The theme values are written out again in the test instead of imported**
  The test spells out the list of theme options literally rather than importing the definition next to the code under test.
  *Fix:* Import the existing type instead of repeating it. — Feasibility: achievable
- **F133** · `src/features/settings/useTheme.ts`:16 · `boundary-without-validation`
  **A theme value read from the database is labelled as one of three options without checking**
  The stored theme is annotated as being one of three known values at the point it is read, but nothing verifies that.
  *Fix:* Add a small check and use it instead of the bare annotation. — Feasibility: achievable
- **F134** · `src/features/stats/StatsPage.tsx`:6 · `discriminated-union-opportunity`
  **The statistics page cannot tell an unloaded library from an empty one**
  The statistics screen takes only the book list and ignores the loading flag beside it.
  *Fix:* Read the loading flag and show a loading state, as the book pages already do. — Feasibility: achievable
- **RT-F308** · `src/lib/ai/errors.ts`:15 · `unknown-misuse`
  **Every AI failure captures its underlying cause, and nothing ever reads it**
  The app's error type carries an untyped slot for the original underlying failure and faithfully fills it in every time. No code anywhere reads it.
  *Fix:* Either use the standard error-cause channel so debuggers can display it, or remove the field.
- **F078** · `src/lib/ai/prompts.ts`:39 · `branded-type-opportunity`
  **Imported book titles are placed into AI prompts exactly as they arrived**
  Titles and authors imported from a spreadsheet are inserted straight into the prompt text, directly above the instructions describing the expected reply.
  *Fix:* Strip line breaks and cap the length where the prompt fragment is assembled. — Feasibility: requires-design
- **F082** · `src/lib/audio/wav.ts`:12 · `boundary-without-validation`
  **A fixed audio format is stamped onto bytes whose real format was discarded**
  The routine that builds a playable audio file encodes a specific sample rate and bit depth as constants, and its input carries no information about what format the bytes actually are.
  *Fix:* Fix it where the format label is thrown away; if this routine is touched, widen it to accept the format rather than assuming. — Feasibility: achievable
- **F136** · `src/lib/base64.ts`:17 · `type-assertion-as-T`
  **An override in the encoding loop pre-suppresses a check that is not yet enabled**
  A value in the byte loop is forced past a warning that the compiler is not currently issuing, so the override does nothing today.
  *Fix:* Restructure the loop so no override is needed under any configuration. — Feasibility: achievable
- **F083** · `src/lib/contrast.ts`:8 · `branded-type-opportunity`
  **The project's own contrast checker returns a plausible wrong number for unparseable colours**
  The colour helper accepts any text and always returns a number. For values it cannot parse it returns either a nonsense number or one derived from partial input.
  *Fix:* Make the parse explicit and report failure rather than returning a number that looks valid. — Feasibility: achievable
- **F038** · `src/lib/covers/index.test.ts`:5 · `boundary-without-validation`
  **Cover-service test fixtures are untyped, so none is checked against the shape the code assumes**
  The test helper that fakes network replies accepts anything, so the sample responses are never compared against the shape the cover code expects.
  *Fix:* Type the helper against the two response shapes and add the missing partial-response cases. — Feasibility: achievable
- **F137** · `src/lib/covers/openLibrary.ts`:8 · `js-implicit-coercion`
  **A cover identifier of zero is treated as 'no cover'**
  The cover lookup uses a truthiness check on a numeric identifier, so an identifier of zero is treated the same as one that is missing.
  *Fix:* Check the value's kind explicitly rather than its truthiness. — Feasibility: achievable
- **F087** · `src/lib/download.test.ts`:1 · `untyped-public-function`
  **The download helper has no declared return type and its test covers only the other function**
  The exported download helper leaves its result unstated, and the test file next to it exercises only the name-slugifying function.
  *Fix:* Add the one-line return annotation. — Feasibility: achievable
- **F138** · `src/lib/download.ts`:2 · `branded-type-opportunity`
  **The download helper takes three interchangeable text arguments in a fixed order**
  The helper receives filename, contents and type as three same-kind positional arguments where the order is entirely load-bearing.
  *Fix:* Collapse the arguments into a single named-field object. — Feasibility: achievable
- **F088** · `src/lib/goodreads.test.ts`:95 · `branded-type-opportunity`
  **Book identifiers from a spreadsheet are put into a cover URL without any validation**
  The identifier read from an imported spreadsheet is used to build a cover image address after only cosmetic cleaning. Nothing checks it is an identifier at all.
  *Fix:* Validate the identifier's shape where the address is built and fall back to no cover when it does not match. — Feasibility: achievable
- **F139** · `src/lib/goodreads.ts`:83 · `discriminated-union-opportunity`
  **A column lookup hides a 'not found' answer inside an ordinary number**
  The routine that finds a spreadsheet column returns a plain number, using minus one to mean 'not found'. That meaning is invisible in the result.
  *Fix:* Return an explicitly absent value instead of a sentinel number. — Feasibility: achievable
- **F140** · `src/lib/goodreads.ts`:113 · `boundary-without-validation`
  **An imported read date is parsed, typed, and then thrown away**
  The date-read column is parsed from the spreadsheet and stored on the parsed row, but nothing downstream ever uses it, and the field it would naturally fill is left blank.
  *Fix:* Either remove the unused field or actually carry it through to the book's finished date. — Feasibility: achievable
- **F141** · `src/lib/goodreads.ts`:121 · `branded-type-opportunity`
  **A book identifier from a spreadsheet is placed into a cover address unencoded**
  The identifier is cleaned of spreadsheet formatting and then inserted directly into a web address without being validated or encoded.
  *Fix:* Validate the identifier's shape where it is produced and return no cover when it does not qualify. — Feasibility: achievable
- **F039** · `src/lib/markdown.test.ts`:20 · `boundary-without-validation`
  **The markdown test always supplies well-formed summaries, so the crashing case is never tried**
  The summary fixture used by the export tests always contains real lists, so the one consumer that would fail on an AI-shaped summary is never exercised.
  *Fix:* Fix the shape check where the AI output is converted, and test it there rather than adding a dishonest fixture here. — Feasibility: requires-design
- **F091** · `src/lib/srs.test.ts`:97 · `branded-type-opportunity`
  **The scheduling tests only use timestamps they generated themselves**
  The due-date tests feed the checker only values it produced, so nothing pins its comparison method to the one the queue actually uses.
  *Fix:* Fold this into the fix for the comparison mismatch rather than testing it separately. — Feasibility: achievable
- **F092** · `src/lib/srs.ts`:33 · `branded-type-opportunity`
  **Two parts of the app compare review due dates in incompatible ways**
  The due date is plain text, and one place compares it as a date while another compares it as text. The rule that makes those agree is written only in comments.
  *Fix:* Delete the unused comparison or route both through one function, so there is exactly one definition of 'due'. — Feasibility: requires-design
- **F093** · `src/lib/srs.ts`:42 · `branded-type-opportunity`
  **The review scheduler claims it always produces a card but can fail on extreme intervals**
  The scheduler's declared result says it always returns a card. Once the computed interval grows past what a date can represent, it throws instead.
  *Fix:* Add an upper limit on the interval and the ease factor so the declared result is true for every input. — Feasibility: achievable
- **F094** · `src/lib/storage/db.ts`:9 · `boundary-without-validation`
  **The database schema promises every stored row is a valid record, which no database can guarantee**
  The storage layer declares the exact shape of every row, and the database library then describes every read accordingly. The database itself validates nothing on the way out.
  *Fix:* Leave the declaration alone and add the checks at the read and write boundaries instead. — Feasibility: requires-design
- **F095** · `src/lib/storage/db.ts`:11 · `branded-type-opportunity`
  **The attachment key is a composite value but is declared as plain text**
  Attachments are keyed by a combination of book and kind, but the key is declared as ordinary text, identical to a different key used by the same store's index.
  *Fix:* Declare the composite key pattern; it is a compile-time-only change with no runtime effect. — Feasibility: achievable
- **F098** · `src/lib/storage/repo.test.ts`:66 · `boundary-without-validation`
  **Deleting a book is never verified to remove its review cards**
  The delete-cascade test checks the book, summary and attachment stores but never the review cards, and the whole review-card storage surface has no tests at all.
  *Fix:* Seed a card in the existing cascade test and assert it is gone afterwards. — Feasibility: achievable
- **F099** · `src/lib/storage/repo.ts`:31 · `boundary-without-validation`
  **Record updates write whatever the caller supplies with no checking**
  The profile and book update routines pass their input straight to the database on the strength of the declared shape alone.
  *Fix:* Add the validation once at the shared write boundary rather than to this routine in isolation. — Feasibility: requires-design
- **F100** · `src/lib/storage/repo.ts`:126 · `branded-type-opportunity`
  **Every identifier in the storage layer is plain text, including two neighbouring methods that take different kinds**
  Book, profile, summary and attachment identifiers are all plain text, so nothing prevents one being passed where another is expected. Two adjacent methods in the same module take different kinds.
  *Fix:* If adopted, introduce distinct identifier types at the single place they are created so the change stays mechanical. — Feasibility: requires-design
- **F112** · `src/lib/storage/repo.ts`:79 · `boundary-without-validation`
  **Review cards are read back and sorted without any checking**
  Every review card is loaded and then filtered and sorted on a timestamp that nothing has verified is text of the expected form.
  *Fix:* Add a cheap check in the due-date filter so a tampered row is skipped rather than breaking the queue. — Feasibility: achievable
- **F101** · `src/test/setup.ts`:11 · `unknown-misuse`
  **Four hand-written network stubs each invent their own shape**
  There is no shared, checked network stub, so four separate test files each write their own against an informal signature, and one is left installed after its test finishes.
  *Fix:* Add one shared, typed stub helper and route all four through it. — Feasibility: achievable
- **F102** · `src/test/smoke.test.tsx`:58 · `boundary-without-validation`
  **The 'no AI call on boot' check is written as a loop that runs zero times when it passes**
  The smoke test asserts the invariant by looping over captured network calls. On the intended path there are none, so the loop body never runs and nothing is asserted.
  *Fix:* Filter the captured calls and assert the filtered count is zero, which is meaningful whether or not calls were captured. — Feasibility: achievable
- **F104** · `src/types.ts`:29 · `branded-type-opportunity`
  **All record identifiers share one plain-text type across the whole app**
  Books, summaries, profiles and review cards all identify themselves with plain text, so the compiler cannot tell one kind from another anywhere.
  *Fix:* If adopted, introduce distinct identifier types, accepting that retrofitting them touches every producer and consumer. — Feasibility: requires-design
- **F105** · `src/types.ts`:33 · `boundary-without-validation`
  **A list of valid book categories exists in the code and is never used**
  A defined set of categories sits in the shared types and nothing references it, while the actual category field accepts any text the AI supplies.
  *Fix:* Either delete the unused list or wire it into both the AI template and the field type. — Feasibility: achievable
- **F143** · `src/types.ts`:105 · `generic-opportunity`
  **The quiz-question shape is written out three separate times**
  The same four fields describing a quiz question are declared independently in three places across two files.
  *Fix:* Declare the shape once and have the other two extend it. — Feasibility: achievable
- **F144** · `tsconfig.json`:8 · `tsconfig-strictness-gap`
  **One compiler check that would catch accidental method shadowing is off, with a single site to fix**
  A checking option that requires deliberate marking when a class member replaces an inherited one is not enabled. Exactly one place would need changing.
  *Fix:* Fix the single site and enable the option. — Feasibility: achievable
- **F145** · `tsconfig.json`:11 · `tsconfig-strictness-gap`
  **Four checking options are off even though enabling them costs nothing today**
  Four additional compiler checks are not switched on, and each of them reports zero problems against the current code.
  *Fix:* Enable all four now; there is no remediation work at all. — Feasibility: achievable
- **F146** · `tsconfig.json`:15 · `tsconfig-strictness-gap`
  **A skipped library-checking option is load-bearing but undocumented**
  The build skips type-checking of third-party declaration files. Disabling that skip produces exactly two failures, both in third-party packages and neither in this project's code.
  *Fix:* Keep the setting and add a short comment recording exactly what it hides. — Feasibility: achievable
- **F147** · `tsconfig.json`:17 · `tsconfig-strictness-gap`
  **Test-runner globals are visible to production code as well as tests**
  The ambient type definitions for the test runner and its matchers are applied to the whole project rather than just the test files.
  *Fix:* Scope the test type definitions to the test files. — Feasibility: requires-design

---

## 3. Verification

Every one of the 148 raw discovery findings was independently re-checked against source by a
verifier that did not produce it, across 10 batches.

| Verdict | Count |
| --- | --- |
| Confirmed | 66 |
| Amended | 75 |
| Refuted | 7 |
| Uncertain | 0 |

Zero "uncertain" verdicts: every finding resolved against evidence rather than needing maintainer
intent. The 75 amendments are not rubber-stamping — 54 of them changed the severity and several
corrected the root cause outright.

### Material corrections made during verification

- **Only 3 of the 7 discovery criticals survived.** The other four dropped to high or medium once
  their claimed trigger was traced. The commonest error was assuming a malformed-localStorage shape
  the original app could not actually produce — verified against commit `670b5fe`, the untouched
  Google AI Studio original.
- **F011/F021 had the right bug and the wrong cause.** Two verifiers independently found that the
  `saveSummary` backfill path they blamed is *dead code* (its only caller returns early when there
  is no summary). The defect is real via a producer both discoverers missed:
  `migrate.ts:105-119` writes `summaryId` while omitting `oneSentenceTakeaway`, making the
  contradiction **deterministic for 100% of migrated legacy books** rather than conditional.
- **Blast-radius counts in Phase 1 were inflated ~40% by counting test files.** Real non-test call
  sites: books 14, profiles 9, blobs 5, summaries 8.
- **F072 and F107 were promoted** medium → high. Both are the unbounded `correctAnswerIndex`
  ingress from Gemini into IndexedDB, which silently produces a review card that can never be
  answered correctly — and recurs daily.
- **F089 measured, not estimated:** `noUncheckedIndexedAccess` yields exactly 10 errors, all in 4
  component files, zero in `src/lib/**`.

### Refuted findings (excluded from all counts)

7 findings did not survive. Recorded here so the reasoning is not lost:

| id | File | Why it was wrong |
| --- | --- | --- |
| F065 | `src/features/library/goodreadsImport.test.tsx`:99 | No type weakness exists here. The 200-row fixture at goodreadsImport.test.tsx:101-106 contains no cast: `status: 'Want to Read' as const` is literal-type narrowing (the opposite of a bypass), and `isbn13` / `dateRead` are declared optional … |
| F084 | `src/lib/covers/googleBooks.ts`:1 | The claimed type weakness does not exist. src/lib/covers/googleBooks.ts:1 and src/lib/covers/openLibrary.ts:1 both declare `Promise<string \| null>`, and that type is ACCURATE for every value either function ever resolves with: googleBooks r… |
| F122 | `src/components/ui/Dialog.test.tsx`:11 | The cited line contains no type weakness. Dialog.test.tsx:11 is `<Dialog open title="Add a book" onClose={onClose}>` inside the Harness — an omitted optional prop, not an assertion, an any, or a lying fixture (the spec's 'lying types in tes… |
| F125 | `src/components/ui/toastStore.ts`:10 | Read both files in full. The duplication is real (toastStore.ts:10 `const listeners = new Set<() => void>()`, :12-14 `emit()`, :39-44 `subscribeToToasts`; apiKey.ts:3 `listeners`, :5-7 `notify()`, :30-35 `subscribeToApiKey`) but it is not a… |
| F127 | `src/components/ui/useFocusTrap.ts`:47 | Both assertions are present (useFocusTrap.ts:47 `const first = items[0]!;`, :48 `const last = items[items.length - 1]!;`) but they are correct as written and the proposed fix does not improve them. Line 45 (`if (items.length === 0) return;`… |
| F135 | `src/lib/ai/errors.ts`:13 | The pattern is present as described (errors.ts:13 `readonly kind: AiErrorKind` as a base-class parameter property; MissingKeyError at :22-26 always passes 'missing-key') but it is the correct type at every existing consumer, and the spec's … |
| F142 | `src/types.ts`:64 | The pattern is present (types.ts:64 `model: string`, with the doc comment at :63 naming 'legacy' as the migration sentinel) but the recommended narrowing would introduce the very defect this audit exists to find, so this should not be actio… |

Two are worth reading in full, because they are cases where the *audit* was the thing making the
error:

- **F084** claimed `Promise<string | null>` was a lying signature. It is not — TypeScript cannot
  express rejection in a return type at all. The complaint was inexpressible, not a weakness.
- **F142** proposed narrowing the persisted `Summary.model` field to a union of current model ids.
  That would *create* a lying type the moment Google retires a model, because old IndexedDB rows
  keep the retired id forever.

---

## 4. Red-team additions

Four adversarial classes were run against the whole repo, orthogonal to the lot-by-lot sweep. They
produced 35 findings: **18 novel** (counted in this report) and
**17 that independently re-discovered a finding discovery had already made**.
The corroborating 17 are attached to their counterparts in `findings.json` and are deliberately
**not** counted again anywhere in this report.

**lying-types** — 7 novel

- RT-F001 (critical) `src/lib/ai/chat.ts`:11 — Opening chat without an API key replaces the entire app with an error screen
- RT-F002 (critical) `src/lib/storage/migrate.ts`:80 — A damaged leftover record from the old app hangs the loading screen forever
- RT-F005 (high) `src/lib/storage/db.ts`:23 — One transient database failure disables all storage for the rest of the session
- RT-F012 (medium) `src/components/AudioPlayer.tsx`:50 — The audio player shows Pause when nothing is actually playing
- RT-F006 (medium) `src/components/EReader.tsx`:182 — A whitespace-only deep dive produces an empty reader that crashes on open
- RT-F010 (medium) `src/lib/ai/summarize.ts`:22 — Wrong-typed AI fields are converted into a finished book and stored as real
- RT-F008 (medium) `src/lib/goodreads.ts`:109 — Imported books with no author or rating are given fake values that the statistics treat as real

**boundary-erasure** — 3 novel

- RT-F102 (high) `src/features/profile/ProfileContext.tsx`:31 — The startup sequence assumes the one-time upgrade can never fail
- RT-F107 (medium) `src/lib/storage/repo.ts`:4 — Every identifier in the app depends on a browser feature that is not always available
- RT-F108 (low) `src/components/AddBookModal.tsx`:174 — A dropdown's raw text value is assumed to be one of three valid priorities

**union-and-brand-near-misses** — 4 novel

- RT-F203 (medium) `src/components/AddBookModal.tsx`:74 — Books you have not read are saved with a rating of four stars that you never gave
- RT-F204 (medium) `src/components/ChatModal.tsx`:73 — A chat failure is displayed as though the assistant said it, or is dropped entirely
- RT-F202 (medium) `src/features/book/useBookRoute.ts`:13 — Moving directly between two books briefly shows the previous book's summary
- RT-F201 (medium) `src/features/library/useLibrary.tsx`:48 — One place creates a book identifier and a summary identifier together, and swapping them would go unnoticed

**assertion-clusters-and-external-any** — 4 novel

- RT-F305 (medium) `src/lib/storage/migrate.ts`:54 — One generic helper manufactures a trusted type for every leftover-data read at once
- RT-F306 (low) `src/components/AudioPlayer.tsx`:29 — A standard library callback silently receives an untyped value, defeating the project's zero-any property
- RT-F307 (low) `src/components/ui/useFocusTrap.ts`:47 — Three overrides do nothing today and would silence a useful check tomorrow
- RT-F308 (low) `src/lib/ai/errors.ts`:15 — Every AI failure captures its underlying cause, and nothing ever reads it

### The most important red-team result is a negative one

**There is no type-assertion cluster.** The class was hunted specifically and came back clean:
17 production `as` casts across 6,546 lines, zero double-casts, four production non-null
assertions. The `idb` and `@google/genai` isolation invariants from CLAUDE.md both hold. The
audit went looking for a sloppy codebase and did not find one — which is exactly why the findings
that *do* exist cluster at boundaries and in library-supplied types rather than in hand-written code.

### Verified negatives worth publishing

These were hunted and came back clean. They are recorded so a future audit does not re-litigate
them, and because several are patterns worth copying:

- src/lib/srs.ts — the SRS scheduler is clean and is the codebase doing this right. `scheduleCard(card: ReviewCard, grade: Grade, now: Date)` and `newCard(input: NewCardInput, now: Date)` have no two adjacent same-typed parameters; `Grade` is the literal union `1 | 2 | 3 | 4`, and both lookup tables are declared `Record<Grade, number>` (srs.ts:10-11) so a typo'd key is a compile error. `NewCardInput` is a named-field object rather than a positional list. There is no `(a: number, b: number)` anywhere in the scheduler. No finding.
- Units and ambiguous numerics — no site exists where two units meet. `readingTimeMinutes` is only ever summed with itself (StatsView.tsx:17) and divided by 60 to produce hours (StatsView.tsx:173). `AudioPlayer` keeps `progress` and `duration` in seconds and never touches a Book field; `volume` (0-1) and `playbackRate` never mix with them. `ProfileView.progressPercent` and the StatsView category bar are both 0-100 and are both consumed as CSS percentages. There is no `pages` count, no 0-1 vs 0-100 collision, and no seconds-vs-minutes collision. No finding.
- `Book.finishedAt?: string` (types.ts:40) is declared and then never written or read anywhere in src/ — grep returns exactly one hit, the declaration itself. `GoodreadsRow.dateRead` is parsed (goodreads.ts:113) and then dropped by `importGoodreadsRows`. So `status === 'Finished'` never implies `finishedAt`, which looks like a discriminated-union near-miss — but under `strict` any future reader is forced to handle `string | undefined`, and there is no consumer today that can be misled. Reported as dead weight, not as a defect.
- Async-status flags — no reachable `isLoading === true && error !== null` combination. `ApiKeyDialog` (`'idle' | 'testing' | 'error'`, ApiKeyDialog.tsx:16) and `ProfileView` (`importStatus`, ProfileView.tsx:48) already model status as a literal union. `BookDetail`'s `isGeneratingAudio` / `isGeneratingDeepDive`, `EReader`'s `isGeneratingAudio`, `AddBookModal`'s `isLoading` and `GoodreadsImport`'s `isImporting` all reset in a `finally`, including on the early-`return` paths. No finding.
- QuizModal's `isAnswered: boolean` + `selectedOption: number | null` (QuizModal.tsx:37-38) are two encodings of one fact, and the type permits `isAnswered === true && selectedOption === null` — but that combination is not constructible: `handleOptionClick` sets both and `handleNext` clears both, and there is no third writer. ReviewPage derives the same fact correctly (`const isAnswered = selected !== null`, ReviewPage.tsx:75). Redundant, not defective. No finding.
- Cover-lookup signatures `fetchCover(title: string, author: string)` (covers/index.ts:12), `fetchGoogleBooksCover(title, author)` and `fetchOpenLibraryCover(title, author)` are textbook two-adjacent-same-typed-params, but there are only two call sites in the whole repo (summarize.ts:53, recommend.ts:37), both are correct, and a swap degrades one cover lookup to a placeholder rather than corrupting anything. This is exactly the pattern-match the spec warns against recommending brands for. Not reported.
- `blobs.put(bookId: string, kind: BlobKind, blob: Blob)` and `blobs.get(bookId, kind)` (repo.ts:129,142) cannot be transposed — `BlobKind` is a literal union, so the second argument is not assignable to the first. `blobKey()` is the single source of the composite key. Clean.
- Enum-ish strings that are bare `string` — swept and mostly clean. `BookStatus`, `Priority`, `VoiceName`, `BlobKind`, `AiErrorKind`, `ToastKind`, `ThemeChoice`/`ResolvedTheme`, EReader's `Theme`/`FontSize`, and `GoodreadsRow.status` are all proper literal unions with exhaustive lookup records where they are dispatched on. The two genuine gaps are `Book.category: string` (types.ts:33, with the `Category` enum at types.ts:6 exported and never imported anywhere) and the `Record<string, number>` priority table — the latter is reported as RT-F205; the former has no consumer that breaks, because both LibraryPage's filter chips and StatsView's breakdown are built dynamically from `new Set(books.map(b => b.category))`, so an unexpected category self-heals into a new chip rather than failing a comparison.
- NO type-assertion cluster exists. AST-accurate census over all 86 source files / 8418 lines: 18 `as T` casts (2.1 per kloc), ZERO `as unknown as T` double casts, 14 non-null assertions of which only 4 are in production code (the other 10 are in tests), plus 5 benign `let x!: T` definite-assignment declarations. The densest file is src/lib/ai/errors.ts with a single cast. No file anywhere in the repo justifies the spec's 'the source type is wrong, re-type the source' recommendation on density grounds. This is an honestly clean result, not an absence of searching.
- Library isolation HOLDS and is worth publishing as an intentional, correct pattern. `idb` is imported in exactly one file (src/lib/storage/db.ts:1) and `@google/genai` in exactly four (src/lib/ai/client.ts:1, chat.ts:1, schemas.ts:1, tts.ts:1) — all inside src/lib. All 20 AI imports from src/components/**, src/features/** and src/app/** resolve to src/lib/ai/*, and all storage access goes through src/lib/storage/repo.ts. The CLAUDE.md layering invariant is satisfied by grep. One caveat, not a finding: src/lib/ai/chat.ts:4 re-exports the SDK's `Chat` class type, so src/components/ChatModal.tsx:29 holds `useRef<Chat | null>` — a value typed with the vendor's full 3-method API (sendMessage, sendMessageStream, getHistory) rather than an opaque handle. Nothing currently calls those methods directly, and the import still routes through the shim, so the invariant is intact; but the shim's public face is wider than its two exported functions need it to be. Narrowing `Chat` to an opaque session handle would close it.
- The `idb` any-trap is avoided. `openDB<BookSumDB>(...)` at src/lib/storage/db.ts:23 is fully parameterised against a complete `DBSchema` (db.ts:7-17), so every get/getAll/put/getAllFromIndex in repo.ts returns a real domain type. Unparameterised `idb` defaults its schema to `unknown` and hands back `any` from every read — this repo never touches that path.
- `unknown` narrowing is correct at 6 of the 8 `unknown` annotation sites. src/app/ErrorBoundary.tsx:5-6 narrows react-router's `useRouteError(): unknown` with `error instanceof Error` before use — the exemplar. src/app/AppShell.tsx:47 and src/components/AddBookModal.tsx:23 both hand `unknown` straight to `toAiError`, which narrows with `instanceof AiError` / `instanceof Error` / `instanceof SyntaxError` / `instanceof TypeError`. src/lib/covers/index.test.ts:5's `(url: string) => unknown` is consumed only by `JSON.stringify` and a `=== null` compare, both of which accept `unknown` legitimately. The only defective `unknown` sites are src/lib/ai/errors.ts (statusOf, already filed elsewhere; `cause`, filed here as RT-F308) and src/app/ShellContext.ts:9 (already filed).
- @testing-library/dom and lucide-react were checked for exported `any` and are clean. Every `any` in @testing-library/dom/types/query-helpers.d.ts is a generic CONSTRAINT position (`Arguments extends any[]`), never a value type; the query functions return `HTMLElement`, so `screen.getByX(...)` never degrades a caller. node_modules/lucide-react/dist/lucide-react.d.ts contains no `any` at all.
- `Response.json(): Promise<any>` (lib.dom) is a real library-sourced `any`, but it never escapes: both call sites (src/lib/covers/googleBooks.ts:12 and src/lib/covers/openLibrary.ts:6) assert a shape on the same expression, so no `any`-typed binding is created. Whether the asserted shape is validated is a boundary finding owned by another class and is deliberately not re-reported here.
- Zero type suppressions in src/**, verified independently of the given baseline: grep for `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck` and any `eslint-disable` comment across all 86 source files returns nothing. There is no suppression backlog to audit.
- src/lib/goodreads.ts is the counter-example that proves RT-F307 is a style inconsistency rather than a house rule. Every index access in the CSV parser is defended with a coalesce — `(table[0] ?? [])` at line 82 and `(cells[index] ?? '')` at line 96 — never with `!`. src/app/AppShell.tsx:70-71 does the same with an explicit `if (!randomBook) return;` guard. The correct pattern is already established in the codebase; only useFocusTrap.ts and base64.ts depart from it.
- react-router's `useLocation()` returns `Location<any>`, so `location.state` is `any` at src/app/AppShell.tsx:32 — but the repo never reads `.state` (zero hits repo-wide), and never passes `state` to `navigate()`. The hole is real and library-sourced but currently unreachable, so it is recorded here rather than filed as a finding.
- `AsyncGenerator<GenerateContentResponse, any, any>` at src/lib/ai/summarize.ts:88 and src/lib/ai/chat.ts:29 carries `any` in its TReturn and TNext parameters (an @google/genai signature choice). Both sites only `for await` the yielded values, which are correctly typed `GenerateContentResponse`; neither calls `.next(x)` or reads the generator's return value, so the `any` is never realised.

**`src/app/ErrorBoundary.tsx:5` is the one boundary in the repo done correctly** — `unknown`
narrowed by `instanceof` rather than asserted. Cite it as the in-repo fix exemplar.

### Classes not run, and why

| Class | Reason |
| --- | --- |
| jsdoc-rot | N/A - repo is 100% TypeScript, no JS-only modules |
| python-except-swallowing | N/A - no Python in repo |
| mypy-pyright-ignore-lists | N/A - no Python in repo |
| generated-types-out-of-sync | N/A - no codegen step; nearest analogue (hand-written Gemini responseSchema) covered by F031/RT04 |
---

## 5. Structural recommendations

**Not implemented — documented for a decision.** These are the changes that would stop whole
categories of finding from recurring, rather than patching individual sites. Each is larger than a
fix and needs agreement before it is worth starting.

### 5.1 Discriminated unions to introduce

Ordered by how much of the finding list each one collapses.

| # | Union | Collapses | Why now |
| --- | --- | --- | --- |
| 1 | **`Book` "is this summarised?"** — `{ summarised: false } \| { summarised: true; summaryId; oneSentenceTakeaway; readingTimeMinutes }` | F050, F011, F012, F043, F059, F041, F021 | One fact is currently stored three ways (`summaryId?`, `oneSentenceTakeaway?`, and a required `readingTimeMinutes` using `0` as its "absent"). All four combinations are representable and two are shipping today. This is the single highest-value type change in the repo. |
| 2 | **Async resource** — `{ status: 'loading' } \| { status: 'ready'; data }` for `useLibrary`, `useProfile`, `useBookRoute`, `useReviewQueue` | F023, F068, F020, F071, F074, F134, RT-F202 | `Book[]` cannot express "not loaded yet", so the initial `[]` renders as an authoritative empty library. Four of six `useLibrary` consumers ignore `isLoading` entirely. |
| 3 | **AI result** — `{ ok: true; value } \| { ok: false; error: AiError }` for the four AI entry points | F035, F076, RT-F001, RT-F204 | Failure is currently encoded as a sentinel string that callers persist as real content ("Failed to generate…" becomes a saved summary). |
| 4 | **Parse result** — make absence representable in `GoodreadsRow` and `columnOf` | RT-F008, F061, F139 | `'Unknown'` and `0` are sentinels typed as real author and rating values; `StatsView` averages those zeros into the user's rating and silently deflates it. |
| 5 | **`AiErrorKind` exhaustiveness** — add an `assertNever` at the consumer | F009, F029 | An 8-member union is narrowed by a two-arm `if`; the missing arms are why a referrer-blocked key never reaches the key dialog. |
| 6 | Local state machines — `ConfirmDialog` pending, `GoodreadsImport` phase, `ChatModal` message | F062, F066, RT-F204 | Each holds one logical state in 2-3 independent nullable slots, and each has a reachable illegal combination. |

### 5.2 Branded types to introduce

Branding is easy to recommend and expensive to retrofit, so this is deliberately a short list —
only where the foot-gun is real and the retrofit is contained. **19 branded-type findings were
raised; 16 of them are recorded as "no wrong call site exists today" and are not recommended for
action.**

| Brand | Sites | Justification |
| --- | --- | --- |
| `BookId` / `SummaryId` | RT-F201, F100, F104 | `useLibrary.tsx:48` is the one site that mints both ids in the same expression. Transposing them compiles and leaves no runtime trace. Ids have exactly one producer (`repo.ts`), so the retrofit is mechanical. |
| `IsoTimestamp` (or delete the duplicate comparator) | F092, F091 | `dueAt` is compared semantically by `srs.ts:58` (`Date.parse`) and lexically by `repo.ts:88` (`localeCompare`). **Cheapest real fix is not a brand at all** — delete the dead `isDue`, or make `repo.ts` call it, so there is exactly one comparison. |
| `Priority` / `ThemeChoice` option lists derived from the union | RT-F108, F133 | Hand-written `<option>` values are asserted into the union they are supposed to match. Derive the options from the union instead of asserting toward it — no brand needed, just direction reversal. |

**Explicitly not recommended:** branding every id in the persistence API (F104 as filed),
`coverImageUrl`, `monthlyGoal`, `Dialog.size`, ISBN, route paths. Each has a cheaper local fix
(sanitise at the repo, narrow the prop to a literal union) that gets the same guarantee without a
repo-wide retrofit.

### 5.3 Generics to extract

- **F143** — the quiz-question shape is declared three times (`types.ts` `QuizQuestion`, `types.ts`
  `ReviewCard`'s four question fields, `srs.ts` `NewCardInput`). Extract one `QuizContent` and
  compose. Small, safe, removes a real drift risk between the AI schema and the persisted card.
- **`apiKey.ts` duplicates `toastStore.ts`'s subscribe/notify store byte-for-byte.** A four-line
  `createStore<T>()` would replace both. Low value, low risk — bundle it with other work.

### 5.4 `unknown` promotions

`unknown` is used correctly at 6 of its 8 sites. The two that are cop-outs:

- **RT-F308 `AiError.cause`** — captured at every failure, read by nothing (grep: zero `.cause`
  hits across all 86 files). Either surface it in diagnostics or drop the shadow field and use the
  standard `Error` `cause` option.
- **F056 `ShellContext.handleAiError(unknown)`** — typed total over `unknown` but throws on `null`
  or `undefined` (see F028, the same underlying `statusOf` bug).

### 5.5 tsconfig flags, ordered by ease of adoption

| Order | Flag | Cost | Do it? |
| --- | --- | --- | --- |
| 1 | `noImplicitReturns`, `noUncheckedSideEffectImports`, `allowUnreachableCode: false`, `allowUnusedLabels: false` | **0 errors** | Yes — free ratchets, enable today |
| 2 | `noImplicitOverride` | 1 error, one line | Yes |
| 3 | `noPropertyAccessFromIndexSignature` | 5 errors, all in `googleBooks.ts` | Yes — but fix the lying `Record<string,string>` source type instead and all 5 vanish without the flag |
| 4 | `noUncheckedIndexedAccess` | 10 errors / 4 files, **zero in `src/lib/**`** | Yes — **but only alongside `no-non-null-assertion`** (F053) |
| 5 | `exactOptionalPropertyTypes` | 9 errors | Deliberate — each is a modelling decision about a record persisted to IndexedDB, where absent-key vs present-undefined actually differ |
| — | `skipLibCheck: false` | 2 errors, both third-party | **No.** Load-bearing. Both are an uninstalled optional peer dep and absent jest types, neither is a source defect |

**The highest-leverage configuration change is not a tsconfig flag at all.** `eslint.config.js`
never sets `parserOptions.project`, so the entire type-aware `@typescript-eslint` tier
(`no-unsafe-assignment`, `no-unsafe-member-access`, `no-unnecessary-type-assertion`,
`no-floating-promises`) is **inert** — verified with `--print-config`. Those are precisely the rules
that fire on the unvalidated `JSON.parse(...) as T` pattern behind 61 of these findings. Turning
that tier on is how this class of finding stops recurring (F008).

---

## 6. Bugs discovered

**This is the section to read first.** These are not type hygiene items — they are shipped defects
that the type weakness was hiding. Each was traced end-to-end to a concrete user action, and the
runtime-crash claims were reproduced by execution rather than reasoned about.

| # | Finding | Severity | Bug |
| --- | --- | --- | --- |
| 1 | F002 / F003 | critical | Chat and Quiz crash the entire app on any book without a summary |
| 2 | RT-F001 | critical | Opening Chat with no API key destroys the app |
| 3 | RT-F002 / RT-F102 | critical | A malformed legacy record hangs boot permanently and duplicates data on every retry |
| 4 | F004 / F022 | critical | A v1 backup file writes binary data into book records |
| 5 | F043 / F011 | high | Every migrated legacy book reads "Not summarised yet" next to "0 min read" |
| 6 | F014 | high | Saving your bio silently reverts your theme |
| 7 | F029 / F009 | high | A referrer-restricted API key reports as a content-safety block, with no way to fix it |
| 8 | RT-F005 | high | One transient IndexedDB failure poisons all storage for the rest of the session |
| 9 | F024 | high | One malformed quiz question deadlocks the review queue permanently |
| 10 | F072 / F107 / F040 | high | A quiz card can be impossible to answer correctly, and it comes back every day |
| 11 | F034 / F035 / F033 | high | A blocked or truncated AI response is saved as a finished summary |
| 12 | F027 | medium | The AI error-handling test suite passes without testing anything |
| 13 | F028 / F056 | medium | The error handler itself throws when handed an empty error |
| 14 | RT-F203 | medium | Books you never read are saved with four stars you never gave |
| 15 | RT-F008 / F061 | medium | Imported books with no rating drag your average rating down |
| 16 | RT-F006 / F013 | medium | A whitespace-only deep dive crashes the reader and shows "Infinity% Complete" |
| 17 | RT-F202 | medium | Navigating between two books briefly shows the previous book's summary |
| 18 | RT-F012 | medium | The audio player shows Pause while nothing is playing |
| 19 | F102 | low | The "no AI call on boot" guarantee is asserted by a loop that runs zero times |

**F002 / F003 — Chat and Quiz crash the entire app on any book without a summary** *(critical)*

Every Goodreads-imported book has no summary by design. Both buttons render anyway. Chat throws inside a `useEffect` with no try/catch, so it escapes to the router error boundary and replaces the whole app. Quiz throws inside a try/catch and blames the AI service for a missing summary. Corroborated independently by the red team (RT-F302).

**RT-F001 — Opening Chat with no API key destroys the app** *(critical)*

The default state of every fresh install. `createBookChatSession` is the only *synchronous* AI entry point, so its `MissingKeyError` is thrown rather than rejected, and its sole consumer calls it bare in a `useEffect`. Instead of opening the key dialog, the app is replaced by the error screen — breaking the documented invariant "the app works with no key; only AI actions gate, and they open the key dialog".

**RT-F002 / RT-F102 — A malformed legacy record hangs boot permanently and duplicates data on every retry** *(critical)*

`migrateLegacyData` is awaited on the boot path inside an uncaught `void (async …)()`, and `setIsLoading(false)` is the last statement. A throw pins the app on the loading spinner forever. Worse: `MIGRATION_MARKER` is written *last*, so every reload re-runs the "one-time" migration and re-duplicates whatever it managed to write.

**F004 / F022 — A v1 backup file writes binary data into book records** *(critical)*

Reachability was *strengthened* during verification: the original app at commit `670b5fe` shipped an export with `version: 1` and inline base64 PDF and audio on each book. Today's import never checks `version`, passes the single `Array.isArray(data.books)` guard, and spreads each v1 book whole into `books.create`. That directly violates the CLAUDE.md invariant *"No binary data in records — this is what broke the original app."*

**F043 / F011 — Every migrated legacy book reads "Not summarised yet" next to "0 min read"** *(high)*

Deterministic for 100% of migrated books, not conditional. `migrate.ts:105-119` writes `summaryId` but omits `oneSentenceTakeaway` from the same `books.create` call, while writing that same takeaway onto the Summary 20 lines later. The library card and the detail page then disagree with each other permanently. The existing migration test asserts `summaryId` and never the takeaway, so it is green.

**F014 — Saving your bio silently reverts your theme** *(high)*

Real data loss. The edit draft is a `useState(profile)` snapshot taken once at mount and never resynced. Use the theme toggle, then edit the bio and save, and the save writes back the stale snapshot — reverting the persisted theme. Same clobber for `favoriteVoice` and `monthlyGoal`.

**F029 / F009 — A referrer-restricted API key reports as a content-safety block, with no way to fix it** *(high)*

`toAiError` substring-matches the SDK's opaque JSON error body *before* checking the typed `status`. Google returns 403 with "are blocked." for a referrer restriction — the obvious hardening for a key living in localStorage on a public demo — so it maps to `safety`, not `invalid-key`. `AppShell.tsx:49` only opens the key dialog for key errors, and that dialog is the app's *only* key-entry surface. The user is told the AI blocked their book and has no recovery path. The 429 → `rate-limited` branch is dead code for the same reason.

**RT-F005 — One transient IndexedDB failure poisons all storage for the rest of the session** *(high)*

`getDb` memoizes the promise before it settles and never clears it on rejection. A single failure — Safari private browsing, a blocked upgrade, storage denied — makes every subsequent `Promise<T>` in the entire repo reject forever, with no recovery short of a reload.

**F024 — One malformed quiz question deadlocks the review queue permanently** *(high)*

A persisted `ReviewCard` with `options: []` renders zero option buttons → `selected` stays null → the grade buttons never render → `grade()` is the only thing that advances the queue. The `dueAt` sort returns the same card after every reload, so every card behind it becomes unreachable. There is no per-card delete to recover.

**F072 / F107 / F040 — A quiz card can be impossible to answer correctly, and it comes back every day** *(high)*

`correctAnswerIndex` arrives unvalidated from Gemini and is persisted forever. It is only ever *compared*, never used to index, so it degrades silently rather than crashing: the card can never be graded correct, and the spaced-repetition scheduler therefore keeps it due. The "0-3" constraint exists only as English prose inside a schema `description` string, while the SDK exposes unused `minimum`/`maximum` fields.

**F034 / F035 / F033 — A blocked or truncated AI response is saved as a finished summary** *(high)*

`response.text || '{}'` coerces the SDK's `undefined` — its real signal for a safety block, a `MAX_TOKENS` truncation, or empty candidates — into an empty object that flows through `??` defaults into a complete-looking `Book` and `Summary`. Separately, `generateDetailedSummary` returns the literal string "Failed to generate…" typed as `string`, and the caller persists it as the book's deep-dive content.

**F027 — The AI error-handling test suite passes without testing anything** *(medium)*

The archetypal green-test-that-proves-nothing. `apiError(status, message = 'boom')` defaults to a message matching *none* of the classification branches, so the whole 400/401/403 `it.each` table passes while the referrer-block misclassification above ships green underneath it.

**F028 / F056 — The error handler itself throws when handed an empty error** *(medium)*

`statusOf` asserts `unknown` to an object and immediately dereferences it, so `toAiError(null)` and `toAiError(undefined)` throw a `TypeError` instead of returning an `AiError`. Reproduced by execution.

**RT-F203 — Books you never read are saved with four stars you never gave** *(medium)*

The modal correctly hides the rating input when status is "Want to Read" — and then persists the untouched default of `4` anyway. The export, the status toggle and the stats all treat it as a real score.

**RT-F008 / F061 — Imported books with no rating drag your average rating down** *(medium)*

The Goodreads parser substitutes `0` for a missing rating, typed as a real rating. `StatsView` averages those zeros in, silently deflating the number the user sees.

**RT-F006 / F013 — A whitespace-only deep dive crashes the reader and shows "Infinity% Complete"** *(medium)*

The `['No content available.']` fallback only fires when `detailedSummary` is falsy, so a whitespace-only value passes it and then `.filter(Boolean)` empties the array. `pages[currentPage]` is typed `string` but is `undefined`. Reproduced by execution.

**RT-F202 — Navigating between two books briefly shows the previous book's summary** *(medium)*

`book` is derived synchronously from the route param; `summary` is written asynchronously by an effect. React Router reuses the same element across `book/:id` changes, so every direct book-to-book navigation commits at least one render where the pair is mismatched.

**RT-F012 — The audio player shows Pause while nothing is playing** *(medium)*

`togglePlay` ignores the promise from `play()` and flips `isPlaying` unconditionally — 21 lines below the same call being correctly `.catch()`-ed.

**F102 — The "no AI call on boot" guarantee is asserted by a loop that runs zero times** *(low)*

A `for` loop over captured fetch calls that iterates zero times on the intended-pass path. It passes having asserted nothing — so the invariant it exists to protect is unprotected.

> Four of these — the two app-destroying crashes, the boot hang, and the binary-data import —
> break invariants that `CLAUDE.md` states explicitly. That is the strongest argument in this
> report for the type-level fixes in §5: the invariants are written down, agreed, and were still
> violated, because nothing mechanical was enforcing them.

---

## 7. Recommended actions

Prioritised. Effort is the fix itself, not the review. "Confidence" is confidence that the finding
is real and the fix shape is right.

| # | Action | Severity | Effort | Confidence | Findings | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Gate the Chat and Quiz buttons on a summary existing, and delete both `summary!` overrides | critical | trivial | high | F002, F003, F015, F012 | Closes the worst crash. `DailyWisdomModal` already models `summary: Summary \| undefined` correctly — copy that shape. |
| 2 | Make the no-key path in `createBookChatSession` recoverable | critical | moderate | high | RT-F001 | Route it through `useShell().handleAiError`, which already opens the key dialog. Needs a "no session" render branch in ChatModal. |
| 3 | Make the legacy migration failure-tolerant, and catch it on the boot path | critical | moderate | high | RT-F002, RT-F102, F007, F037, F044 | Per-book try/catch + a `failed` count; write the marker unconditionally; wrap the `ProfileContext` await. Fixes the permanent boot hang *and* the re-duplication. |
| 4 | Validate the backup file before the first write | critical | moderate | high | F004, F022, F051, F048 | Parse to `unknown`, check `version`, validate each element. One guard closes the user-file boundary and the `importLibrary` parameter lie together. |
| 5 | Validate Gemini JSON at the four parse boundaries | high | moderate | high | F005, F016, F030, F033, F034, F052, F072, F107, F040 | The repo already has the right pattern in `RawBookResponse` (all-optional + narrow). Apply it to quiz, recommendations and both summarize sites. Removes the largest single cluster in this report. |
| 6 | Write `oneSentenceTakeaway` in the migration | high | trivial | high | F043, F011 | One line, next to the existing `summaryId`. Fixes a user-visible contradiction on 100% of migrated libraries. Add the missing assertion to `migrate.test.ts` in the same commit. |
| 7 | Check the typed `status` before substring-matching the error body | high | trivial | high | F029, F009, F027 | Restores the only recovery path for a restricted key, and revives the dead 429 branch. Fix the `'boom'` test fixture at the same time or it will stay green either way. |
| 8 | Merge the profile edit draft against the live record on save | high | trivial | high | F014 | Stops the theme/voice/goal clobber. Smaller and safer than resyncing the draft. |
| 9 | Clear the `getDb` memo on rejection | high | trivial | high | RT-F005 | One `.catch` that nulls `dbPromise` and rethrows. Turns a permanent session-wide failure into a retryable one. |
| 10 | Turn on the type-aware ESLint tier | high | moderate | high | F008 | **Highest-leverage single change in the report.** Set `parserOptions.projectService`, add `recommendedTypeChecked`. These are the rules that catch the `JSON.parse(...) as T` pattern behind 61 findings. Expect a backlog on first run — land it with the boundary fixes above, not before. |
| 11 | Add `satisfies Schema` to the three Gemini response schemas | high | trivial | high | F031 | Proven with the repo's own `tsc`: compiles unchanged today and catches the `properites`-typo class. The schemas are currently the *only* shape enforcement and get zero compile-time checking. |
| 12 | Bounds-check `correctAnswerIndex` and reject empty `options` at the queue boundary | high | trivial | high | F024, F072, F107 | Two filters. Also protects the cards already persisted in users' databases, which a producer-side fix alone will not reach. |
| 13 | Enable the four zero-cost tsconfig flags | medium | trivial | high | F109 family | Measured at 0 errors. Free ratchets against regression. |
| 14 | Enable `noUncheckedIndexedAccess` **with** `no-non-null-assertion` | medium | moderate | high | F109, F053, F013, F117 | 10 errors / 4 files / zero in `src/lib`. Must land together or the cheapest fix is to append `!` and trade a compile error for a runtime crash. |
| 15 | Introduce the `Book` summarised discriminated union | medium | significant | high | F050, F011, F012, F059 | Do the one-line F043 fix first — this is the durable version and needs a decision, not a patch. |
| 16 | Introduce the async-resource union across the four hooks | medium | significant | medium | F023, F068, F020, F071, F074, F134, RT-F202 | Fixes the false "Your library is quiet" empty state on every cold load and the cross-book summary mismatch. |
| 17 | Brand `BookId` / `SummaryId` at their single producer | low | moderate | medium | RT-F201, F100, F104 | Contained because ids have exactly one producer. Everything else on the branded-type list is explicitly *not* recommended. |
| 18 | Add a `vite-env.d.ts` narrowing `import.meta.env` | low | trivial | high | F146, RT-F103 | Three lines. Closes the one unannounced hole in the repo's zero-`any` property. |

### Sequencing note

Actions 1-9 are independent and can land in any order; every one is contained and reversible.
**Action 10 (the ESLint tier) should land after 4-5, not before** — turning on
`no-unsafe-assignment` over unvalidated boundaries produces a large error list that is mostly the
work items in 4-5, and reviewing it before those land wastes the signal.

Actions 15-16 are the two that need a decision rather than a patch. Neither blocks anything else.

---

## Appendix — how to read the data files

| File | Contents |
| --- | --- |
| `findings.json` | **Canonical.** All 159 live findings with full description, evidence, verifier note, reachability, blast radius and `suggestedPatch`; plus `boundaryInventory` (56), `assertionCensus`, `verifiedNegatives` (18), `strictFlagMeasurements`, the 17 red-team corroborations and the 7 refutations. |
| `waves.json` | The fix-wave plan — one spawnable session per wave, with a ready-to-run prompt. |
| `verified.json` | Phase 3 raw output: all 148 discovery findings with per-finding verdicts. |
| `redteam.json` | Phase 4 raw output: all 35 red-team findings across 4 classes. |
| `aggregate.json` | Phase 2 deduplicated discovery set. |
| `findings/`, `verifications/`, `redteam/` | Per-lot and per-batch raw subagent output. |
| `state.md` | Full audit trail, including deviations and the facts established in each phase. |

**Severity fields:** `findings.json` reports the **post-verification** severity as `severity`, and
preserves the original discovery value as `originalSeverity` with a `severityChanged` flag. 54
findings differ between the two. Anything quoting the Phase 1 numbers is quoting a superseded set.

## Fix Waves

159 live findings across 68 files → **12 waves**. **One wave = one session.** Each wave/session owns related files from one severity tier (up to 18 findings a session). Launching the waves spawns exactly 12 session(s) — one per wave, no hidden fan-out.

> **Drive mode.** Each wave runs autonomously (`/dev-pipeline --auto`) by default — it drives itself to a ready-to-merge tag with no check-ins. Run a wave interactively only if you want to review its steps.

> **Safety & scope.** Each wave OWNS its listed files, but a session may follow a bug to its root cause in a shared file (type, index, helper, test) and fix it there — it NOTES every such out-of-scope edit in its summary. Give each session its own worktree so those edits reconcile at merge. Waves are **priority-ordered, not dependency-ordered** (criticals first), and grouped by folder within a tier so each session works on related code. How many you run at once is a launch-time choice — NOT baked into the plan.

| Wave | Severity | Findings | Files |
| --- | --- | --- | --- |
| W1 | critical | F002, F012, F059, F117, F118, F004, F014, F060, F120, F003, RT-F204, RT-F001, F076 | `src/components/BookDetail.tsx`<br>`src/components/ProfileView.tsx`<br>`src/components/ChatModal.tsx`<br>`src/lib/ai/chat.ts` |
| W2 | critical | RT-F002, F007, F043, F044, F042, F096, F097, RT-F305 | `src/lib/storage/migrate.ts` |
| W3 | high | F008, F053, F050, F051, F052, F107, F103, F106, F108, F104, F105, F143, F009, F115, F015, F016, F017, F011 | `eslint.config.js`<br>`src/types.ts`<br>`src/app/AppShell.tsx`<br>`src/components/QuizModal.tsx`<br>`src/components/BookCard.tsx` |
| W4 | high | F022, F023, F069, RT-F201, F131, F019, F066, RT-F102, F071, F024, F072, F040, F092, F093, F037, F136 | `src/features/library/useLibrary.tsx`<br>`src/features/library/GoodreadsImport.tsx`<br>`src/features/profile/ProfileContext.tsx`<br>`src/features/review/ReviewPage.tsx`<br>`src/lib/srs.ts`<br>`src/lib/base64.ts` |
| W5 | high | F031, F032, F079, F080, F034, F035, F033, RT-F010, F029, F028, RT-F308, F005, F030 | `src/lib/ai/schemas.ts`<br>`src/lib/ai/summarize.ts`<br>`src/lib/ai/errors.ts`<br>`src/lib/ai/quiz.ts`<br>`src/lib/ai/recommend.ts` |
| W6 | high | F048, F046, F047, F049, F113, F114, RT-F107, F099, F100, F112, RT-F005, F094, F095 | `src/lib/storage/repo.ts`<br>`src/lib/storage/db.ts` |
| W7 | medium | F109, F110, F111, F144, F145, F146, F147, F055, F116, F001, F010, F054, F056, RT-F203, F057, F058, RT-F108 | `tsconfig.json`<br>`src/app/routes.tsx`<br>`src/app/routing.test.tsx`<br>`src/app/ErrorBoundary.tsx`<br>`src/app/ShellContext.ts`<br>`src/components/AddBookModal.tsx` |
| W8 | medium | RT-F012, F148, RT-F306, F013, RT-F006, F061, F121, F063, F126, RT-F307, RT-F202, F067, F068, F128, F129, F018, F064 | `src/components/AudioPlayer.tsx`<br>`src/components/EReader.tsx`<br>`src/components/StatsView.tsx`<br>`src/components/ui/useFocusTrap.ts`<br>`src/features/book/useBookRoute.ts`<br>`src/features/library/LibraryPage.tsx`<br>`src/features/library/goodreadsImport.test.tsx` |
| W9 | medium | F020, F021, F070, F025, F073, F074, F089, F090, RT-F008, F139, F140, F141, F036, F027, F077, F026, F081 | `src/features/library/useLibrary.test.tsx`<br>`src/features/profile/ProfileContext.test.tsx`<br>`src/features/review/reviewQueue.test.tsx`<br>`src/features/review/useReviewQueue.ts`<br>`src/lib/goodreads.ts`<br>`src/lib/base64.test.ts`<br>`src/lib/ai/errors.test.ts`<br>`src/lib/ai/apiKey.test.ts`<br>`src/lib/ai/tts.ts` |
| W10 | medium | F086, F137, F085, F006, F041, F045, F098 | `src/lib/covers/openLibrary.ts`<br>`src/lib/covers/googleBooks.ts`<br>`src/lib/storage/migrate.test.ts`<br>`src/lib/storage/repo.test.ts` |
| W11 | low | F119, F062, F123, F124, F130, F075, F132, F133, F134, F083, F087, F138, F088, F039, F091, F078, F082, F038 | `src/components/DailyWisdomModal.tsx`<br>`src/components/ui/ConfirmDialog.tsx`<br>`src/components/ui/Dialog.tsx`<br>`src/components/ui/toastStore.test.ts`<br>`src/features/library/RecommendationCarousel.tsx`<br>`src/features/settings/useTheme.test.tsx`<br>`src/features/settings/useTheme.ts`<br>`src/features/stats/StatsPage.tsx`<br>`src/lib/contrast.ts`<br>`src/lib/download.test.ts`<br>`src/lib/download.ts`<br>`src/lib/goodreads.test.ts`<br>`src/lib/markdown.test.ts`<br>`src/lib/srs.test.ts`<br>`src/lib/ai/prompts.ts`<br>`src/lib/audio/wav.ts`<br>`src/lib/covers/index.test.ts` |
| W12 | low | F101, F102 | `src/test/setup.ts`<br>`src/test/smoke.test.tsx` |

_The ready-to-run spawn prompt for every wave (one per session) is in `waves.json`._
