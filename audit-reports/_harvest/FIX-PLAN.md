# Fix plan — all findings, in waves by severity

Status key: `[ ]` todo · `[x]` done · `[~]` partial · `[-]` refuted/not-a-bug

Generated from 450 open findings (5 already fixed by the overnight merge).

## Wave 1 — critical (12)

### vite.config.ts (2)
- [ ] `test-efficiency/F001` L13 — Framework boot is 98% of suite wall-clock — 2.53s of assertions inside a 140.53s run, because jsdom is built for every test file including the 12 that have no DOM
- [ ] `test-efficiency/F002` L16 — Uncapped thread pool makes per-file boot ~98% of the run and silently drops the 7 heaviest test files, including both of this lot's

### src/app/AppShell.tsx (1)
- [ ] `S091` L105 — There is no navigation at all on phones — Review, Stats and Profile are unreachable

### src/app/routes.tsx (1)
- [ ] `S151` L31 — The documented GitHub Pages deployment cannot work — no Vite base and no router basename

### src/components/BookDetail.tsx (1)
- [ ] `feature-discovery/F001` L461 — No "Summarise this book" action — every Goodreads-imported book is a permanent dead end

### src/components/ProfileView.tsx (1)
- [ ] `S081` L386 — A fake 'Privacy Mode — Local storage encryption' toggle advertises a security feature that does not exist

### src/features/library/useLibrary.tsx (1)
- [ ] `S001` L114 — importLibrary overwrites existing summaries for books it skipped as duplicates

### src/features/profile/ProfilePicker.tsx (1)
- [ ] `S160` L59 — Deleting a profile destroys its entire library in one unguarded click

### src/features/review/useReviewQueue.ts (1)
- [ ] `feature-discovery/F003` L44 — Due-card count is computed but never surfaced outside /review — the planned nav badge was never shipped

### src/lib/audio/wav.ts (1)
- [ ] `feature-discovery/F004` L31 — Generated narration is never cached — every play re-bills a paid TTS call, and the audio blob kinds are write-only

### src/lib/storage/repo.ts (1)
- [ ] `S010` L4 — crypto.randomUUID() is undefined outside a secure context — any plain-HTTP deploy throws on first write

### src/types.ts (1)
- [ ] `feature-discovery/F005` L40 — Book.finishedAt is in the schema but never written — the monthly reading goal cannot be monthly without it

## Wave 2 — high (102)

### src/components/BookDetail.tsx (8)
- [ ] `S040` L64 — SummaryRenderer body text has no dark variant
- [ ] `S036` L163 — Every generated audio blob URL leaks for the life of the page
- [ ] `S037` L202 — handleOpenPdf leaks a blob URL per click
- [ ] `S042` L214 — Marking a book Finished never records finishedAt
- [ ] `feature-discovery/F007` L253 — Preview-before-add mode is fully built inside BookDetail but no caller can reach it
- [ ] `type-safety/F012` L337 — Four independent encodings of 'is this book summarised?' leave three dead buttons and one empty section
- [ ] `S038` L381 — Quick Listen and Read Full Summary render for unsummarised books and silently do nothing
- [ ] `S039` L453 — The One Sentence Takeaway panel is unreadable in dark mode

### src/components/QuizModal.tsx (6)
- [ ] `type-safety/F015` L23 — QuizModal repeats the same required-`summary` lie; the `!` at the call site turns a missing summary into a bogus "AI error" toast
- [ ] `feature-discovery/F010` L47 — A general SM-2 scheduler whose only card source is an AI quiz — so the review deck cannot be filled without an API key
- [ ] `type-safety/F016` L52 — Unvalidated model JSON is persisted straight into IndexedDB as `ReviewCard`s, permanently poisoning the spaced-repetition queue
- [ ] `S057` L71 — Quiz generation re-fires whenever the book or summary object identity changes
- [ ] `S056` L140 — Quiz results screen loads a background texture from a third-party CDN
- [ ] `S058` L243 — The Next Question button is a dark button on a dark footer in dark mode

### src/lib/storage/repo.ts (5)
- [ ] `S007` L35 — profiles.remove is non-atomic; partial failure orphans an entire library
- [ ] `type-safety/F048` L52 — books.create and summaries.upsert persist caller objects with no validation, and the backup-import path feeds them a user-picked file
- [ ] `S006` L68 — books.remove spans four independent transactions with no atomicity
- [ ] `S008` L78 — reviewCards.listByProfile full-scans every card of every profile
- [ ] `S009` L94 — reviewCards.listByBook full-scans the card store, and books.remove calls it per book

### src/types.ts (5)
- [ ] `type-safety/F050` L47 — Three independent Book fields encode the single fact "is this book summarised", and they disagree on how to spell "no"
- [ ] `type-safety/F107` L88 — ReviewCard.correctAnswerIndex has no type-level relation to options, and out-of-range LLM values are persisted permanently
- [ ] `feature-discovery/F020` L91 — Every grade writes ease / intervalDays / reviewCount and no surface in the app ever reads them back
- [ ] `type-safety/F051` L98 — LibraryExport declares a fully-formed backup shape but is only ever produced by an unchecked cast of a user-supplied file
- [ ] `type-safety/F052` L105 — QuizQuestion declares every field required but is populated by an unchecked cast of an LLM response

### src/components/ProfileView.tsx (4)
- [ ] `type-safety/F014` L46 — Stale edit-draft is typed identically to the live Profile, so saving silently reverts the theme
- [ ] `S082` L47 — editedProfile snapshots the profile once and never resyncs, so saving reverts concurrent changes
- [ ] `S083` L54 — The 'Monthly Goal' card measures lifetime totals, not the month
- [ ] `feature-discovery/F009` L96 — The JSON backup drops the profile record and every review card, so a device move silently loses settings and all spaced-repetition progress

### src/lib/ai/schemas.ts (4)
- [ ] `type-safety/F031` L3 — The Gemini responseSchema objects are the only shape enforcement and receive zero compile-time checking
- [ ] `S143` L23 — The schema marks nine fields required while the TypeScript type marks all nine optional
- [ ] `S141` L64 — QUIZ_SCHEMA expresses 'exactly 4 options' as prose, not as a constraint
- [ ] `S142` L69 — correctAnswerIndex is an unbounded NUMBER where it should be a bounded INTEGER

### src/lib/storage/migrate.ts (4)
- [ ] `type-safety/F007` L58 — JSON.parse(raw) as T types arbitrary localStorage content as LegacyBook[] on the app-boot path
- [ ] `type-safety/F043` L105 — Migration sets summaryId without the denormalised oneSentenceTakeaway, so every migrated book shows 'Not summarised yet'
- [ ] `type-safety/F044` L110 — Legacy book fields are defaulted with ?? which guards nullish only, never type, then persisted as a typed Book
- [ ] `S013` L147 — Migration gives every legacy book a summaryId and an empty Summary row

### src/app/AppShell.tsx (3)
- [ ] `S092` L47 — Only two of six AI call sites can route the user to the key dialog
- [ ] `type-safety/F009` L49 — AiErrorKind narrowing is non-exhaustive and unguarded, so a referrer-blocked key never reaches the key dialog
- [ ] `S093` L201 — Closing the audio player is where the blob URL should be revoked, and is not

### src/components/AddBookModal.tsx (3)
- [ ] `feature-discovery/F006` L59 — Every add path except the Goodreads CSV tab requires a Gemini key, despite 'library CRUD' being promised keyless
- [ ] `S065` L221 — The PDF drop zone cannot be reached or activated by keyboard
- [ ] `S064` L250 — The 10MB PDF limit is advertised in the UI and never enforced anywhere

### src/components/AudioPlayer.tsx (3)
- [ ] `S049` L188 — Play/pause icon is invisible in dark mode
- [ ] `S048` L215 — `dark:` appended after an arbitrary-variant selector retargets the wrong element
- [ ] `S046` L244 — Dark-mode codemod stranded opacity modifiers on the dark half, making 5 light-mode surfaces fully opaque

### src/components/EReader.tsx (3)
- [ ] `feature-discovery/F008` L173 — Reading position is computed and displayed as "% Complete" but never persisted — the reader always reopens at section 1
- [ ] `S073` L253 — The reader is a full-screen overlay with no focus trap, no role, and no Escape handler
- [ ] `S072` L393 — key={currentPage} was written inside the className string, so the page-turn animation never replays

### src/features/library/LibraryPage.tsx (3)
- [ ] `feature-discovery/F011` L44 — `summaryId` is stored on every book but there is no way to filter or count unsummarised books
- [ ] `S097` L188 — The empty state flashes on every load because isLoading is never consulted
- [ ] `feature-discovery/F012` L188 — Library grid has no multi-select, so bulk re-categorise / re-status / delete is impossible

### src/features/review/ReviewPage.tsx (3)
- [ ] `type-safety/F072` L76 — correctAnswerIndex is never bounds-checked against options.length, so a card can be silently impossible to answer correctly
- [ ] `S106` L93 — A card with an empty options array deadlocks the review session permanently
- [ ] `type-safety/F024` L93 — A persisted ReviewCard with an empty options array permanently deadlocks the review session

### src/lib/ai/errors.ts (3)
- [ ] `S004` L40 — statusOf() dereferences error without a null guard; toAiError(null) throws inside the error handler
- [ ] `S003` L53 — 'quota' substring is tested before HTTP status, so 429 rate-limits are reported as exhausted quota
- [ ] `type-safety/F029` L53 — AiErrorKind is discriminated by substring-searching the SDK's opaque JSON error body, so key-restriction 403s are reported as content-safety blocks and rate limits as exhausted quota

### src/lib/ai/summarize.ts (3)
- [ ] `S016` L46 — No timeout or AbortSignal on any Gemini call
- [ ] `type-safety/F034` L52 — `response.text || '{}'` erases a blocked or truncated completion, fabricating a complete-looking Book that gets persisted
- [ ] `type-safety/F035` L99 — generateDetailedSummary returns a failure sentinel typed as `string`, which callers persist as a real summary

### src/lib/srs.ts (3)
- [ ] `type-safety/F040` L18 — correctAnswerIndex is a bare number taken straight from unvalidated LLM JSON and persisted forever
- [ ] `S021` L58 — isDue() and repo.listDue() implement due-ness two different ways
- [ ] `S022` L58 — A card with an unparseable dueAt is invisible forever

### src/components/BookCard.tsx (2)
- [ ] `S161` L43 — The library grid is mouse-only — book cards are divs
- [ ] `type-safety/F011` L89 — "Is this book summarised?" is encoded three independent ways on `Book`; BookCard renders two of them and visibly contradicts itself

### src/components/StatsView.tsx (2)
- [ ] `S111` L174 — The 'Wisdom Milestone' card states a fabricated insight about the user's reading
- [ ] `S112` L203 — The interactive stat cards are divs, so the dashboard filters are mouse-only

### src/features/library/GoodreadsImport.tsx (2)
- [ ] `type-safety/F019` L24 — CSV file boundary trusts any user-picked bytes: no MIME, size, or header-shape gate before persisting rows
- [ ] `S120` L38 — A failed Goodreads import reports nothing at all

### src/features/library/useLibrary.tsx (2)
- [ ] `type-safety/F022` L102 — importLibrary declares `payload: LibraryExport` for an unvalidated user JSON file and persists each element unchecked
- [ ] `S002` L109 — importLibrary is not idempotent

### src/features/profile/ProfilePage.tsx (2)
- [ ] `S152` L24 — Resetting the library fires one full library reload per book, concurrently
- [ ] `S153` L25 — Reset hardcodes a cache key that is exported as a constant and used that way elsewhere

### src/features/review/useReviewQueue.ts (2)
- [ ] `S105` L20 — A repo failure pins the page on its loading spinner forever
- [ ] `S104` L33 — Double-clicking a grade button drops the next card without ever grading it

### src/lib/ai (2)
- [ ] `S124` L1 — The entire AI layer is untested — 8 modules, and the ones carrying the most findings
- [ ] `S184` L1 — The seam carrying the most defects has no integration test at all

### src/lib/goodreads.ts (2)
- [ ] `feature-discovery/F018` L88 — Goodreads `Bookshelves` column is never parsed, so every imported book lands as category 'Other' and collapses three live category surfaces
- [ ] `S024` L113 — dateRead is parsed from the CSV and then thrown away

### eslint.config.js (1)
- [ ] `type-safety/F008` L9 — ESLint runs only the non-type-aware typescript-eslint tier — every type-checked rule is inert

### index.html (1)
- [ ] `S178` L12 — Every page load fetches fonts from Google's CDN, contradicting the app's central privacy claim

### package.json (1)
- [ ] `S125` L7 — The declared Node engine is one the dependencies disclaim

### src/App.tsx (1)
- [ ] `S170` L22 — The first screen a user ever sees ignores dark mode entirely

### src/components/ChatModal.tsx (1)
- [ ] `S116` L50 — The chat session is rebuilt on object identity, silently wiping the conversation mid-chat

### src/components/DailyWisdomModal.tsx (1)
- [ ] `S047` L42 — Daily Wisdom close button is invisible in light mode

### src/components/ui/ConfirmDialog.tsx (1)
- [ ] `S145` L21 — A second confirm() before the first settles strands the first promise forever

### src/components/ui/useFocusTrap.ts (1)
- [ ] `S146` L13 — The focus trap traps Tab but leaves the background readable to screen readers

### src/features/book/useBookRoute.ts (1)
- [ ] `S154` L21 — Every library mutation hands BookDetail a brand-new Summary object, which is what makes the quiz and chat re-fire

### src/features/library/goodreadsImport.test.tsx (1)
- [ ] `S194` L93 — All three 'never calls Gemini' tests pass when the spy is never called at all

### src/features/review/reviewQueue.test.tsx (1)
- [ ] `S183` L149 — The suite builds the exact input that deadlocks the review queue, then asserts something else

### src/features/settings/ApiKeyDialog.tsx (1)
- [ ] `feature-discovery/F013` L14 — Key-management API is fully built but the settings surface for it was never made — no way to see, replace or remove the Gemini key

### src/features/settings/useTheme.ts (1)
- [ ] `S171` L29 — Dark mode is applied in an effect, so dark-mode users get a white flash on every load

### src/lib/ai/chat.ts (1)
- [ ] `feature-discovery/F014` L11 — Chat conversations are discarded on close — the SDK's `history` resume parameter is never used

### src/lib/ai/models.ts (1)
- [ ] `S195` L3 — Every model ID is a preview build, in a repo people will clone months from now

### src/lib/ai/prompts.ts (1)
- [ ] `feature-discovery/F015` L55 — Chat is per-book only — no assistant that can see the whole library

### src/lib/ai/quiz.ts (1)
- [ ] `type-safety/F005` L16 — Quiz JSON is cast to QuizQuestion[] with no runtime guard, then persisted to IndexedDB as ReviewCards

### src/lib/ai/recommend.ts (1)
- [ ] `type-safety/F030` L30 — Recommendations cast to a required-field type with no guard; a missing title throws inside the cover fallback and loses all six results

### src/lib/base64.ts (1)
- [ ] `type-safety/F037` L5 — base64ToBytes declares a total (string) => Uint8Array but atob throws on any non-base64 input, and it is fed unvalidated localStorage JSON

### src/lib/covers/googleBooks.ts (1)
- [ ] `S027` L9 — No timeout on any cover fetch

### src/lib/covers/index.ts (1)
- [ ] `feature-discovery/F017` L12 — The keyless cover provider chain is reachable only from AI code paths, so Goodreads imports and no-key users never use it

### src/lib/storage/libraryExport.ts (1)
- [ ] `S126` L98 — The backup format silently omits the profile and every review card

### vite.config.ts (1)
- [ ] `test-efficiency/F032` L17 — jsdom window + fake-indexeddb install + jest-dom registration are rebuilt once per test file (24x, ~29s of worker time each) because `isolate` is left at its default and `poolOptions.threads` is unset

## Wave 3 — medium (192)

### src/components/EReader.tsx (10)
- [ ] `S077` L33 — formatInline is duplicated verbatim between EReader and BookDetail
- [ ] `S078` L53 — Two different markdown renderers produce different output for the same content
- [ ] `S075` L173 — Reading position, theme and font size all reset on every open
- [ ] `S074` L174 — The reader always opens in light theme even when the app is in dark mode
- [ ] `feature-discovery/F022` L174 — Reader theme and font size reset to light/text-lg on every open, ignoring the profile the app already persists
- [ ] `feature-discovery/F023` L219 — Full-screen reader has no keyboard paging and no Escape-to-close — paging is mouse-only
- [ ] `feature-discovery/F049` L224 — Text selection is styled in all three reader themes but selecting a passage does nothing — no way to capture a quote while reading
- [ ] `S076` L320 — Theme and font-size controls are icon-only with no accessible name or pressed state
- [ ] `type-safety/F013` L395 — `pages[currentPage]` is typed `string` but can be `undefined`, crashing the reader on a whitespace-only deep dive
- [ ] `feature-discovery/F024` L421 — Reaching the end of a summary offers only "Close Reader" — the app's one inferable status transition is dropped, and `Book.finishedAt` has never had a writer

### src/components/ProfileView.tsx (9)
- [ ] `S088` L11 — VOICES duplicates the VoiceName union and can drift from it silently
- [ ] `file-decomposition/F002` L28 — ProfileView mixes profile identity/preference editing with the app's entire library backup-restore-reset surface
- [ ] `feature-discovery/F025` L53 — Monthly goal has no month scoping and no history because Book.finishedAt is declared in the schema and never written
- [ ] `S085` L87 — Both export paths swallow failures silently
- [ ] `S084` L97 — handleExport hand-rolls the download helper the file already imports
- [ ] `feature-discovery/F026` L156 — 'Edit Profile' cannot edit the profile name — the field is captured at creation and then permanently fixed
- [ ] `feature-discovery/F027` L275 — The five-voice narration picker gives no way to hear any voice before choosing
- [ ] `S086` L291 — The selected voice chip is invisible in dark mode
- [ ] `S087` L399 — Danger Zone, Privacy card, export buttons and the goal ring track are all light-only

### src/components/BookDetail.tsx (8)
- [ ] `file-decomposition/F001` L33 — BookDetail.tsx (539 lines, repo's largest) bundles a self-contained markdown-to-JSX renderer with the book detail screen
- [ ] `S162` L243 — BookCard already solves the broken-cover problem; BookDetail ignores the solution
- [ ] `S044` L243 — Cover image has no onError fallback
- [ ] `feature-discovery/F047` L346 — Per-book retention state is written on every quiz but never shown on the book's own page
- [ ] `type-safety/F059` L452 — BookDetail reads the Summary's takeaway while BookCard reads the denormalised copy, and they visibly disagree
- [ ] `feature-discovery/F048` L490 — Actionable Steps are generated for every book and rendered inert — no completion state, no cross-book action list
- [ ] `S043` L517 — Personal notes save on blur only, so unmounting mid-edit loses them
- [ ] `S041` L528 — Deep-dive loading panel and the Move back to Queue button are light-only

### src/features/library/LibraryPage.tsx (8)
- [ ] `feature-discovery/F031` L22 — react-router is a production dep used only as a path->component map; library filter state never reaches the URL
- [ ] `S099` L25 — An empty library shows hardcoded recommendations with a refresh button that silently does nothing
- [ ] `type-safety/F067` L35 — localStorage recommendation cache is cast to a concrete shape and rendered without validation
- [ ] `feature-discovery/F032` L54 — One hardcoded sort order for the library, with no user control and no persisted view state
- [ ] `feature-discovery/F052` L86 — `previewRecommendation` does not preview — it spends an AI call and permanently adds the book; the preview UI it was named for is dead code
- [ ] `S100` L178 — The active category chip is near-invisible in dark mode
- [ ] `type-safety/F068` L188 — LibraryPage renders the zero-books empty state during the initial load because it never reads `isLoading`
- [ ] `S098` L207 — Filtering to an empty result offers 'Add Your First Book' instead of clearing the filter

### src/lib/storage/repo.ts (8)
- [ ] `type-safety/F046` L8 — profiles.list() types getAll output from the DBSchema declaration and immediately calls a string method on it
- [ ] `S127` L42 — The repo modules disagree with each other about cascading and about what they accept
- [ ] `type-safety/F047` L44 — books read path returns DBSchema-declared Book[] with no runtime guard; numeric fields are consumed in arithmetic downstream
- [ ] `feature-discovery/F043` L92 — The card store has no browse or management surface — listByBook exists purely for dedup and cards can only be removed by deleting the book
- [ ] `type-safety/F113` L113 — summaries.getByBook returns an unverified index hit typed Summary, whose array fields are consumed without guards
- [ ] `feature-discovery/F019` L129 — PDFs can only be attached when a book is created, so every Goodreads-imported book is permanently PDF-less
- [ ] `type-safety/F114` L138 — The stored MIME type is an unconstrained string, uncoupled from BlobKind, and is replayed into a same-origin blob: URL
- [ ] `type-safety/F049` L143 — blobs.get trusts record.bytes and record.type verbatim; a non-ArrayBuffer silently produces a corrupt Blob instead of an error

### src/components/AudioPlayer.tsx (6)
- [ ] `S051` L29 — A rejected play() leaves the UI claiming it is playing
- [ ] `feature-discovery/F046` L45 — Full transport UI never registers with the Media Session API — no OS media keys, no metadata in the browser media hub
- [ ] `S052` L52 — isPlaying has two independent writers
- [ ] `feature-discovery/F021` L56 — Playback position is tracked every timeupdate and discarded — no resume, and AudioTrack carries no book identity to resume against
- [ ] `S050` L135 — Codemod darkened text that already sits on a permanently dark surface
- [ ] `S054` L187 — Play/pause and speed buttons have no accessible name

### src/components/QuizModal.tsx (6)
- [ ] `S061` L41 — Quiz generation has no cancellation path
- [ ] `S192` L64 — Logging is unstructured, unprefixed, and duplicated against the toast it accompanies
- [ ] `S062` L78 — An out-of-range correctAnswerIndex silently scores every answer wrong
- [ ] `S060` L167 — Close button has no accessible name and answer feedback is not announced
- [ ] `type-safety/F017` L183 — `correctAnswerIndex` is used as an index into `options` with no bounds relationship in the type; an out-of-range index silently makes the quiz unwinnable
- [ ] `S059` L191 — Answer feedback colours have no dark variants

### src/components/StatsView.tsx (6)
- [ ] `feature-discovery/F002` L14 — The dashboard titled "Your Progress" has no time axis, though `Book.addedAt` is written on every book and charted nowhere
- [ ] `S113` L17 — Total Learning reads 0m for any imported library
- [ ] `S114` L18 — Average rating counts unrated books as zero
- [ ] `type-safety/F061` L20 — `Book.rating: number` conflates "unrated" with "rated 0", so the average-rating stat is silently wrong for imported libraries
- [ ] `feature-discovery/F029` L30 — No view of the user's own AI history: `Summary.generatedAt` and `Summary.model` are written on every summary and read by no production code
- [ ] `feature-discovery/F030` L167 — The "Wisdom Milestone" insight card is a hardcoded string chosen by `finished.length > 5`, sitting two lines below the real category data it pretends to describe

### src/lib/goodreads.ts (5)
- [ ] `feature-discovery/F042` L90 — Goodreads `My Review` and `Private Notes` columns are never parsed, though `Book.personalNotes` is a first-class edited-and-exported field
- [ ] `type-safety/F089` L96 — Every CSV indexed access is typed as a definite value; the runtime guards are invisible to the compiler
- [ ] `type-safety/F090` L104 — CSV `My Rating` coerced with parseInt and stored unvalidated as an unbounded `number`
- [ ] `feature-discovery/F054` L113 — `Date Read` is parsed into `GoodreadsRow.dateRead` then silently discarded; `Book.finishedAt` exists in the schema but is never written or read anywhere
- [ ] `S025` L122 — coverForIsbn omits ?default=false, so unknown ISBNs render a blank image

### src/types.ts (5)
- [ ] `S018` L6 — Category enum is exported but nothing consumes it
- [ ] `feature-discovery/F044` L6 — The Category enum is dead code; the real taxonomy is prose in an AI prompt and the user can never set a category
- [ ] `type-safety/F103` L24 — ISO-8601 timestamps are bare strings whose format is load-bearing for sorting, and one is piped in unvalidated from localStorage
- [ ] `type-safety/F106` L51 — Book.hasPdf is a denormalised copy of blob-store existence that the caller must state twice, unchecked
- [ ] `type-safety/F108` L99 — LibraryExport.version is a literal tag that no consumer ever narrows on, so older backups import as v2

### src/app/AppShell.tsx (4)
- [ ] `feature-discovery/F045` L58 — Daily Wisdom is a hardcoded one-item resurfacing engine that can only ever show a takeaway
- [ ] `S094` L63 — Daily-wisdom dedup key uses toDateString(), a locale- and timezone-dependent string
- [ ] `S172` L68 — Daily Wisdom can pick a book with no summary and show an empty quote
- [ ] `S095` L171 — No skip-to-content link ahead of a 4-item persistent nav

### src/app/routing.test.tsx (4)
- [ ] `test-efficiency/F003` L9 — routing.test.tsx is the #2 most expensive file (4,285 ms, 24% of suite test-body time): every one of its 6 tests re-seeds IndexedDB and boots the whole app
- [ ] `type-safety/F001` L47 — Routing test drives an unsummarised book to its detail page and stops one click short of the summary! crash
- [ ] `test-efficiency/F009` L56 — The back-button test (1,837 ms, #2 in the suite) re-executes the entire forward-navigation test above it before it does anything of its own
- [ ] `type-safety/F010` L94 — No test navigates to an unmatched URL, so useRouteError()'s unnarrowed unknown silently turns every 404 into a generic error

### src/components/AddBookModal.tsx (4)
- [ ] `S068` L42 — convertFileToBase64 assumes a well-formed data URL
- [ ] `S069` L64 — A PDF is held three times over during upload
- [ ] `S066` L94 — Rejecting a file leaves the previous valid file selected and submittable
- [ ] `S067` L162 — Rating input accepts any number despite min/max

### src/components/ChatModal.tsx (4)
- [ ] `S119` L73 — Closing the drawer mid-stream does not cancel the request
- [ ] `S130` L83 — Raw SDK errors are console-logged without scrubbing — PLAUSIBLE key exposure, needs verification
- [ ] `S117` L87 — A stream that fails after emitting text shows a truncated reply and no error
- [ ] `S118` L155 — User message bubbles are unreadable in dark mode

### src/features/library/useLibrary.tsx (4)
- [ ] `S138` L102 — No import path is safe to retry after a partial failure
- [ ] `S019` L111 — importLibrary preserves the source book id and put()s it
- [ ] `type-safety/F023` L170 — useLibrary returns an untagged `{ books, isLoading }` bag, so `Book[]` cannot distinguish 'empty' from 'not loaded yet'
- [ ] `type-safety/F069` L185 — The feature's entire public contract is inferred: `LibraryApi = ReturnType<typeof useLibraryState>`

### src/lib/ai/schemas.ts (4)
- [ ] `type-safety/F079` L8 — `category` is an unconstrained STRING in the schema, a plain `string` in TS, and the allowed list exists only in prompt prose
- [ ] `S144` L18 — rating and readingTimeMinutes are unbounded numbers described in prose as bounded
- [ ] `type-safety/F080` L18 — `rating` and `readingTimeMinutes` carry their ranges only in description text and are persisted unvalidated
- [ ] `type-safety/F032` L69 — QUIZ_SCHEMA leaves correctAnswerIndex as NUMBER and options unbounded, so the only enforcement layer permits ungradeable quizzes

### src/lib/storage/migrate.ts (4)
- [ ] `type-safety/F042` L94 — LegacyProfile declares current-app union types for unvalidated JSON, and those values are persisted as a typed Profile
- [ ] `type-safety/F096` L127 — keyInsights/actionableSteps defaulted with ?? [] are declared string[] but a non-array legacy value survives
- [ ] `type-safety/F097` L136 — base64ToBytes is handed a value only declared to be a string, on the unguarded boot path
- [ ] `S014` L140 — finishedAt is never populated for migrated 'Finished' books

### src/test/smoke.test.tsx (4)
- [ ] `test-efficiency/F005` L8 — smoke.test.tsx is the single most expensive file in the suite (4,328 ms, 24% of all test-body time) because 4 of its 5 tests boot the whole app
- [ ] `S185` L58 — The 'no Gemini call on boot' test passes vacuously if fetch is never called
- [ ] `test-efficiency/F006` L64 — The slowest single test in the whole 176-test suite (2,183 ms) sits in the smoke tier and is 8 UI steps deep, 3 of them re-doing the previous test's flow
- [ ] `S186` L85 — A tautological test asserts the test environment, not the app

### .github/workflows/ci.yml (3)
- [ ] `S129` L3 — No deploy workflow exists despite the README pointing at a hosted demo
- [ ] `test-efficiency/F007` L9 — No `timeout-minutes` on the only job, so this suite's documented hang mode can occupy a runner for GitHub's 360-minute default
- [ ] `test-efficiency/F024` L20 — Six serial steps in one job with no `if: always()` — the first failing check hides every later result, costing an extra full pipeline per hidden failure

### src/components/BookCard.tsx (3)
- [ ] `S163` L17 — CORRECTION to S136 — there IS scar tissue: a guard against the literal string 'null'
- [ ] `S164` L31 — Priority badges and the rating chip are light-only
- [ ] `S165` L61 — Every card promises 'Read Masterclass' on hover, including books with no summary

### src/features/review/ReviewPage.tsx (3)
- [ ] `feature-discovery/F034` L7 — Grade buttons show hardcoded interval hints when the exact next interval is one pure-function call away
- [ ] `S107` L98 — Options are keyed by their own text
- [ ] `feature-discovery/F035` L130 — No keyboard shortcuts in the review session, the app's only high-repetition surface

### src/lib/ai/prompts.ts (3)
- [ ] `S196` L12 — The category list exists three times: a dead enum, a prompt string, and free-text on Book
- [ ] `feature-discovery/F038` L39 — Ratings, status, priority, personal notes and the deep-dive are collected but never reach any prompt
- [ ] `S199` L81 — 'Quick Listen' narrates the entire 350-500 word summary

### src/lib/ai/summarize.ts (3)
- [ ] `type-safety/F033` L36 — `?? []` / `|| 'fallback'` in toGenerated guard only nullish values, so a wrong-typed field is persisted and crashes every later read
- [ ] `feature-discovery/F039` L52 — Token usage is returned on every AI response and thrown away — no cost visibility in a bring-your-own-key product
- [ ] `S017` L60 — summarizePdf inlines the whole PDF with no size check

### src/lib/covers/googleBooks.ts (3)
- [ ] `feature-discovery/F040` L8 — Three cover candidates are fetched and two thrown away, and a book's cover can never be changed after it is created
- [ ] `type-safety/F085` L12 — Google Books HTTP response asserted into a shape with zero runtime validation
- [ ] `feature-discovery/F016` L12 — Both providers parse a rich metadata response down to a single image URL, discarding page counts and subjects that Book already has fields for

### src/lib/storage/migrate.test.ts (3)
- [ ] `type-safety/F006` L8 — Migration fixtures are always well-formed, so a throwing migration that permanently hangs boot is green
- [ ] `type-safety/F041` L96 — Migration test asserts summaryId but never the denormalised oneSentenceTakeaway it must move with
- [ ] `S187` L107 — The migration test file has eleven tests and none touches the field the known migration bug is in

### tsconfig.json (3)
- [ ] `type-safety/F109` L8 — noUncheckedIndexedAccess is off — 10 real unchecked-index sites, several on rendered UI paths
- [ ] `type-safety/F110` L8 — exactOptionalPropertyTypes is off — 9 sites write explicit `undefined` into `?:` fields persisted to IndexedDB
- [ ] `type-safety/F111` L8 — noPropertyAccessFromIndexSignature is off, masking a lying `Record<string, string>` on the Google Books boundary

### src/app/ErrorBoundary.tsx (2)
- [ ] `type-safety/F054` L6 — useRouteError() is unknown but is narrowed only by `instanceof Error`, so every 404 renders a generic message
- [ ] `S155` L16 — The crash screen prints the raw error message to the user

### src/app/routes.tsx (2)
- [ ] `S156` L12 — No catch-all route, so an unknown URL renders 'Something went wrong'
- [ ] `type-safety/F055` L12 — routeTable is exported with no RouteObject[] annotation, which disables excess-property checking on the whole route tree

### src/components/ui/Toast.tsx (2)
- [ ] `S198` L9 — Error and success toasts are light-only; only the info variant was given dark variants
- [ ] `S197` L21 — Each new toast resets the dismissal countdown for every toast already on screen

### src/components/ui/useFocusTrap.ts (2)
- [ ] `type-safety/F063` L18 — `querySelectorAll<HTMLElement>` is an unchecked assertion over a runtime selector string in the app's shared focus trap
- [ ] `S147` L29 — Focus restoration silently drops to body when the trigger is gone

### src/features/library/goodreadsImport.test.tsx (2)
- [ ] `type-safety/F018` L9 — The only CSV fixture is a canonical Goodreads header, so the parser's silent-coercion path for foreign CSVs is untested
- [ ] `test-efficiency/F013` L22 — Two library test files carry a byte-identical jsdom+IndexedDB harness, paying two full runner boots for 0.99s of assertions

### src/features/library/useLibrary.test.tsx (2)
- [ ] `type-safety/F020` L11 — The isLoading flag is only ever waited through, never asserted, so the false empty state on cold load is invisible
- [ ] `type-safety/F021` L84 — saveSummary is called by zero tests and the one summary test never asserts the denormalised Book fields

### src/features/profile/ProfileContext.tsx (2)
- [ ] `type-safety/F071` L10 — ProfileContextValue models loading and profile as independent fields, so the type permits acting on a null profile mid-load
- [ ] `S128` L35 — Migration-before-read is a load-bearing ordering enforced only by statement order in one effect

### src/features/review/reviewQueue.test.tsx (2)
- [ ] `S188` L10 — The hook-probe pattern leaks state through a module-level binding
- [ ] `type-safety/F025` L144 — The suite's only options: [] card is built to be cascade-deleted, never mounted in the queue

### src/lib/ai/errors.test.ts (2)
- [ ] `type-safety/F027` L4 — apiError fixture defaults its message to 'boom', so the 403 -> invalid-key assertion proves nothing
- [ ] `type-safety/F077` L4 — No fixture passes a non-object to toAiError(error: unknown), which throws on null/undefined via an unguarded as-cast

### src/lib/ai/errors.ts (2)
- [ ] `type-safety/F028` L40 — statusOf asserts an `unknown` caught value into an object and dereferences it, so toAiError throws a TypeError instead of returning an AiError for null/undefined
- [ ] `S005` L59 — HTTP 400 mapped to 'invalid-key'

### src/lib/base64.test.ts (2)
- [ ] `test-efficiency/F016` L1 — Two pure base64 assertions (10.2 ms) pay a full jsdom + fake-IndexedDB + React Testing Library boot (~7.3 s)
- [ ] `type-safety/F036` L4 — base64 suite has two happy-path tests only; base64ToBytes is total in its type but throws on the one input path it serves

### src/lib/covers/index.ts (2)
- [ ] `S028` L12 — Cover lookups are uncached and cost up to 3 network round trips each
- [ ] `feature-discovery/F041` L12 — fetchCover accepts only title and author, forcing a second unvalidated ISBN cover path to live outside the chain

### src/lib/storage/db.ts (2)
- [ ] `S011` L21 — getDb() has no failure path
- [ ] `S012` L23 — openDB registers no blocked/blocking/terminated handlers

### src/lib/storage/repo.test.ts (2)
- [ ] `type-safety/F045` L13 — The only books.create fixture cannot produce a fat record, so the 'no binary data in records' invariant is unguarded
- [ ] `S189` L65 — Cascade tests cover the happy path only, and reviewCards has no direct tests

### src/test/setup.ts (2)
- [ ] `test-efficiency/F004` L2 — The single global setup file installs a full IndexedDB implementation and the jest-dom matcher set into all 24 test files — 167.15s of cumulative setup time, most of it for files that use neither
- [ ] `test-efficiency/F021` L13 — Shared setup file hard-requires DOM globals, blocking the documented `node` environment escape hatch for every pure-logic test

### CLAUDE.md (1)
- [ ] `S132` L1 — CLAUDE.md documents a NightyTidy run date and nothing about the project

### eslint.config.js (1)
- [ ] `type-safety/F053` L17 — no-non-null-assertion is not enabled — 12 unguarded `!` assertions, and nothing stops more being added

### index.html (1)
- [ ] `S180` L10 — The favicon is an absolute path that breaks under a project-page base

### package.json (1)
- [ ] `S131` L28 — Pinning strategy is inconsistent and nothing checks for advisories

### src (1)
- [ ] `S193` L1 — Compliance summary: theme fails, mobile fails, security claim fails, cost passes

### src/app/ShellContext.ts (1)
- [ ] `type-safety/F056` L9 — handleAiError is typed total over `unknown` but throws on a null or undefined throwable

### src/components/BookDetail.test.tsx (1)
- [ ] `test-efficiency/F010` L3 — BookDetail.test.tsx boots the Google GenAI SDK through three independent import paths plus the IndexedDB repo, to assert which buttons render

### src/components/ChatModal.test.tsx (1)
- [ ] `test-efficiency/F026` L51 — ChatModal > 'stays open and shows the reason' costs 1036 ms because it is the file's FIRST *ByRole query, not because of its own work [IMPORT]

### src/components/DailyWisdomModal.tsx (1)
- [ ] `S174` L90 — Daily Wisdom's primary button is dark-on-dark, and its close button is white-on-white

### src/components/ui/Dialog.tsx (1)
- [ ] `S148` L28 — Backdrop click discards a half-filled form with no warning

### src/components/ui/toastStore.ts (1)
- [ ] `S149` L17 — crypto.randomUUID() again — the third module that breaks outside a secure context

### src/features/library/GoodreadsImport.tsx (1)
- [ ] `S121` L19 — Re-selecting the same file after an error does nothing

### src/features/library/RecommendationCarousel.tsx (1)
- [ ] `S173` L85 — REFERENCE IMPLEMENTATION — the carousel does correctly what three other surfaces get wrong

### src/features/library/recommendationDefaults.ts (1)
- [ ] `feature-discovery/F033` L7 — Recommendation seed list is a fixed six-book array never deduped against the user's own library

### src/features/profile/ProfileContext.test.tsx (1)
- [ ] `type-safety/F070` L16 — selectProfile is wired behind a non-null assertion that would throw, and no test ever clicks it

### src/features/profile/ProfilePicker.tsx (1)
- [ ] `S166` L16 — A failed profile creation reports nothing

### src/features/review/useReviewQueue.ts (1)
- [ ] `type-safety/F074` L46 — useReviewQueue has no return annotation, so `current` is inferred as a definite ReviewCard while the runtime returns undefined

### src/features/settings/ApiKeyDialog.tsx (1)
- [ ] `S168` L14 — The key dialog can only set a key, never inspect, replace or remove one

### src/features/settings/useTheme.ts (1)
- [ ] `feature-discovery/F036` L33 — The per-profile preference mechanism exists but persists exactly one preference; reader theme and font size reset on every open

### src/lib/ai/apiKey.test.ts (1)
- [ ] `type-safety/F026` L1 — src/lib/ai ships 11 modules and 2 test files; every JSON.parse-as-T boundary is in the untested nine

### src/lib/ai/apiKey.ts (1)
- [ ] `S034` L30 — API key changes in another tab are never observed

### src/lib/ai/chat.ts (1)
- [ ] `type-safety/F076` L35 — sendMessageStream returns `Promise<string>` that is silently empty on a blocked completion, leaving a permanently blank chat bubble

### src/lib/ai/client.ts (1)
- [ ] `S015` L24 — testApiKey burns a full generateContent call on the summary model

### src/lib/ai/models.ts (1)
- [ ] `feature-discovery/F037` L2 — One fixed quality tier and no regenerate — the pro model is already wired but unreachable for summaries, and `Summary.model` is recorded and never read

### src/lib/ai/quiz.ts (1)
- [ ] `S032` L17 — Malformed quiz JSON silently yields zero questions

### src/lib/ai/recommend.ts (1)
- [ ] `S033` L34 — One failing cover lookup discards all six recommendations

### src/lib/ai/tts.ts (1)
- [ ] `type-safety/F081` L27 — The audio part's mimeType is discarded and the PCM format is hardcoded, so a format change produces silently corrupt WAV

### src/lib/audio/wav.test.ts (1)
- [ ] `test-efficiency/F015` L1 — Two WAV-header assertions (16.1 ms) pay a jsdom boot; `Blob`/`DataView` are Node globals

### src/lib/base64.ts (1)
- [ ] `S029` L14 — bytesToBase64 converts a whole PDF on the main thread

### src/lib/contrast.test.ts (1)
- [ ] `test-efficiency/F017` L2 — All 4 pure-logic lib tests (50 tests, 143.6 ms of assertions) are booted through jsdom + the React/fake-indexeddb setup graph they never touch

### src/lib/covers/index.test.ts (1)
- [ ] `test-efficiency/F018` L1 — Cover-lookup tests (43 ms, fetch fully stubbed) pay a full jsdom + fake-IndexedDB + RTL boot they never use

### src/lib/covers/openLibrary.ts (1)
- [ ] `type-safety/F086` L6 — OpenLibrary search response asserted to `{ docs?: { cover_i?: number }[] }` without validation

### src/lib/download.ts (1)
- [ ] `S030` L11 — revokeObjectURL runs synchronously after click(), which can cancel the download

### src/main.tsx (1)
- [ ] `S179` L1 — No global handler for unhandled promise rejections

### vite.config.ts (1)
- [ ] `S133` L17 — Suite wall-clock is dominated by environment construction, not by tests

## Wave 4 — low (144)

### src/components/AudioPlayer.tsx (6)
- [ ] `feature-discovery/F066` L12 — The player models exactly one track with no next/previous — no listening queue over a multi-book library
- [ ] `feature-discovery/F056` L24 — Playback speed resets to 1x on every play, though the profile already persists the sibling audio preference
- [ ] `type-safety/F148` L64 — `HTMLMediaElement.duration` enters state as a plain `number` that can be `NaN` or `Infinity`, and is then both formatted and truthiness-tested
- [ ] `S055` L97 — formatTime renders NaN:NaN when metadata never loads
- [ ] `feature-discovery/F057` L111 — No way to save the generated narration, despite an established download helper and a local-first product stance
- [ ] `S053` L222 — Conflicting display utilities on one element

### src/lib/goodreads.ts (6)
- [ ] `type-safety/F139` L83 — `columnOf` returns a bare `number` hiding a `-1` not-found sentinel that no type can narrow
- [ ] `feature-discovery/F053` L83 — A fully format-agnostic CSV spine is hardcoded to six Goodreads header names; a second importer is a column map, not a parser
- [ ] `S026` L111 — Imported rating is never clamped to 0-5
- [ ] `type-safety/F140` L113 — `dateRead` is parsed and typed as `string` with no format contract, then silently discarded
- [ ] `type-safety/F141` L121 — `isbn13` is an unvalidated bare `string` interpolated unencoded into a persisted cover URL
- [ ] `file-decomposition/F008` L121 — OpenLibrary cover-URL construction lives in two modules: covers/openLibrary.ts and goodreads.ts

### src/components/AddBookModal.tsx (5)
- [ ] `feature-discovery/F059` L30 — Add-book form resets status, priority and rating to static defaults on every open
- [ ] `type-safety/F057` L42 — `reader.result as string` asserts away `ArrayBuffer | null` at the PDF file boundary, then indexes the split result without a bounds check
- [ ] `S071` L91 — File validation rejects on MIME type alone
- [ ] `type-safety/F058` L91 — A file is accepted as "a PDF" on the strength of the browser-reported `File.type` alone, and the advertised 10MB limit is never enforced
- [ ] `S070` L257 — Error banner and selected-file label are light-only

### src/components/BookDetail.tsx (5)
- [ ] `S045` L34 — A hand-rolled markdown renderer lives inside a component file
- [ ] `type-safety/F117` L71 — Unchecked-indexed-access cluster: 7 sites across the lot typed `string` where the runtime can yield `undefined`
- [ ] `type-safety/F118` L199 — Blob MIME type is a bare `string` carried from storage into `window.open` with no check
- [ ] `S135` L461 — The single highest-value missing feature is a Summarise button
- [ ] `feature-discovery/F067` L509 — Notes exist on every book but there is no in-app surface that shows them together

### src/components/ProfileView.tsx (5)
- [ ] `type-safety/F120` L53 — `monthlyGoal: number` permits 0 and NaN, producing `strokeDasharray="NaN, 100"`
- [ ] `S089` L54 — A monthlyGoal of 0 renders the ring as 100% complete
- [ ] `type-safety/F060` L116 — `e.target?.result as string` erases three real possibilities from FileReader's result
- [ ] `feature-discovery/F050` L258 — The profile's free-text 'Bio & Motivation' never reaches the AI recommender, which sees only titles and categories
- [ ] `S090` L409 — Reset All fires onResetLibrary with no confirmation at this level

### src/features/library/LibraryPage.tsx (5)
- [ ] `type-safety/F128` L22 — The 'All' sentinel shares a value space with real, AI-generated category strings
- [ ] `type-safety/F129` L56 — Priority score map typed `Record<string, number>` instead of `Record<Priority, number>`
- [ ] `S102` L65 — categories rebuilds a Set over the whole library on every render
- [ ] `S101` L86 — previewRecommendation does not preview — it creates the book and navigates away
- [ ] `S103` L153 — Status filter labels and the empty-state icon lack dark variants

### src/lib/storage/repo.test.ts (5)
- [ ] `S191` L5 — Setup and fixtures are re-declared across roughly eight test files
- [ ] `test-efficiency/F041` L29 — The storage tier's slowest-decile entries are first-touch warm-up artifacts, not workload — optimising those tests will not help
- [ ] `S190` L31 — The UUID assertion is unanchored
- [ ] `type-safety/F098` L66 — The cascade test omits reviewCards, and the whole reviewCards store surface is untested
- [ ] `test-efficiency/F020` L104 — 5 MiB blob fixture costs ~34 ms in `blobs > round-trips a blob without inflating the book record` for two size-agnostic assertions

### src/types.ts (4)
- [ ] `file-decomposition/F007` L6 — Dead `Category` enum is the only runtime-emitting declaration in an otherwise pure-type module
- [ ] `type-safety/F104` L29 — Book/Summary/Profile/ReviewCard ids are all bare string, and one adjacent-line call site would silently swallow a swap
- [ ] `type-safety/F105` L33 — Book.category is an unconstrained string fed by the LLM, while the Category enum declared right above it is dead code
- [ ] `type-safety/F143` L105 — The quiz-question shape is declared three separate times across types.ts and srs.ts

### tsconfig.json (4)
- [ ] `type-safety/F144` L8 — noImplicitOverride is off — one unmarked override in the AI error class hierarchy
- [ ] `type-safety/F145` L11 — Four zero-cost strictness flags are unset — they add 0 errors today but nothing locks the property in
- [ ] `type-safety/F146` L15 — skipLibCheck: true masks an unresolved module in the @google/genai type surface (legitimate, but undocumented)
- [ ] `type-safety/F147` L17 — Vitest and jest-dom globals are in the type scope of production source, not just tests

### .github/workflows/ci.yml (3)
- [ ] `test-efficiency/F033` L3 — No `concurrency` group — superseded runs are never cancelled, so a rapid push sequence runs N full pipelines to completion
- [ ] `test-efficiency/F025` L23 — CI preserves no test-run manifest and no per-test timing, so neither a slowest-decile baseline nor a short collection is detectable from a CI run
- [ ] `test-efficiency/F034` L24 — `tsc --noEmit` runs twice per CI run — line 20 explicitly, then again inside `npm run build` at line 24

### src/components/EReader.tsx (3)
- [ ] `file-decomposition/F004` L27 — EReader.tsx (477 lines) bundles a 135-line themed markdown renderer with the reader shell; clean one-directional split available
- [ ] `S079` L130 — Numbered-list detection mis-parses decimals at the start of a line
- [ ] `S080` L219 — No keyboard paging in a reading surface

### src/components/StatsView.tsx (3)
- [ ] `feature-discovery/F028` L12 — Category bars are inert while the two status cards drill down — the filter state is typed `BookStatus | null` so it cannot express a category
- [ ] `S115` L18 — avgRating returns a string or a number depending on the branch
- [ ] `type-safety/F121` L23 — `Record<string, number>` claims total key coverage; only a `|| 0` coercion saves the read of a key that does not exist yet

### src/features/library/GoodreadsImport.tsx (3)
- [ ] `type-safety/F066` L15 — Import workflow held as three independent states, letting a failed pick import the previous file's rows
- [ ] `S123` L24 — The whole CSV is read into memory with no size guard
- [ ] `S122` L79 — The preview does not mention that every book will land in the 'Other' category

### src/features/library/RecommendationCarousel.tsx (3)
- [ ] `type-safety/F130` L12 — A recommendation title doubles as its identity for both the React key and the in-flight marker
- [ ] `S176` L36 — Carousel scrolls a hardcoded 340px against cards that are 280px or 320px wide
- [ ] `S177` L81 — Recommendations are keyed by title

### src/features/review/ReviewPage.tsx (3)
- [ ] `S109` L12 — Grade button hover states are light-only
- [ ] `S108` L52 — Finishing a session shows the same 'Nothing due' empty state as never having started one
- [ ] `S110` L131 — No keyboard grading in a keyboard-shaped task

### src/lib/download.ts (3)
- [ ] `type-safety/F138` L2 — downloadText takes three adjacent bare-string positional params, so swapping filename and contents compiles cleanly
- [ ] `feature-discovery/F063` L2 — Data flow is one-way at the CSV boundary: the app ingests Goodreads CSV but can never emit one, and `downloadText`'s mimeType parameter is never overridden
- [ ] `S031` L21 — slugify can leave a trailing hyphen

### src/lib/srs.ts (3)
- [ ] `S023` L11 — INTERVAL_MODIFIER[1] is dead
- [ ] `type-safety/F092` L33 — dueAt is a bare string whose fixed-width-UTC-ISO invariant is unenforced, and two consumers compare it in incompatible ways
- [ ] `type-safety/F093` L42 — scheduleCard declares a total return of ReviewCard but throws RangeError once ease/interval go non-finite; ease has a floor and no ceiling

### src/lib/storage/db.ts (3)
- [ ] `type-safety/F094` L9 — DBSchema value types promise every read row is a valid domain object, but IndexedDB validates nothing on the way out
- [ ] `type-safety/F095` L11 — blobs store key is a composite `${bookId}:${kind}` but is declared plain string, identical to the by-book index key
- [ ] `feature-discovery/F064` L33 — The blob store holds unbounded binary data with no enumeration API and no usage surface

### src/lib/storage/repo.ts (3)
- [ ] `type-safety/F099` L31 — profiles.update and books.update write whatever the caller hands them, persisting NaN as a typed number
- [ ] `type-safety/F112` L79 — reviewCards read path loads every row unvalidated and sorts on dueAt with a string method
- [ ] `type-safety/F100` L126 — Every identifier in the persistence API is a bare string, including two adjacent methods that take different id kinds

### src/app/AppShell.tsx (2)
- [ ] `type-safety/F115` L70 — Indexed access is typed Book but is Book | undefined at runtime; the author's own guard is dead code per the types
- [ ] `S096` L152 — Switch-profile hover state is light-only

### src/app/ErrorBoundary.tsx (2)
- [ ] `S134` L1 — Errors reaching the boundary are not recorded anywhere the user can retrieve
- [ ] `S159` L10 — Crash screen icon chip is light-only

### src/components/DailyWisdomModal.tsx (2)
- [ ] `S175` L65 — The book row is a div onClick duplicating the button below it
- [ ] `type-safety/F119` L71 — `coverImageUrl: string` doubles as a "no cover" sentinel that only BookCard knows about; DailyWisdomModal renders it raw

### src/components/ui/Dialog.test.tsx (2)
- [ ] `test-efficiency/F027` L21 — First *ByRole query per file adds 400-900 ms in all three component test files in this lot, inflating 3 of the suite's top 6 slowest tests
- [ ] `test-efficiency/F012` L39 — Dialog > 'traps Tab inside the dialog' costs 1038 ms — 3 direct-API userEvent.tab() calls at ~175-316 ms each [CPU]

### src/components/ui/Dialog.tsx (2)
- [ ] `type-safety/F123` L12 — `Dialog`'s `size` prop is a bare `string` where only a handful of Tailwind max-width classes are valid
- [ ] `file-decomposition/F006` L24 — Modal shell (backdrop + aria-modal root) is hand-rolled in three components instead of reusing components/ui/Dialog, and the copy has drifted

### src/components/ui/toastStore.test.ts (2)
- [ ] `test-efficiency/F036` L1 — toastStore.test.ts runs 16 ms of DOM-free logic inside a full jsdom environment with fake-indexeddb and Testing Library loaded
- [ ] `type-safety/F124` L25 — Redundant non-null assertions on array indices mark a tsconfig gap the tests would then mask

### src/components/ui/toastStore.ts (2)
- [ ] `S150` L9 — The toast queue is unbounded
- [ ] `feature-discovery/F051` L21 — The app's only notification channel carries text only — no action affordance, and one of its three kinds is dead

### src/features/library/goodreadsImport.test.tsx (2)
- [ ] `type-safety/F064` L55 — Optional chain over Array.find's Book | undefined makes the summaryId assertion vacuous
- [ ] `test-efficiency/F038` L99 — `imports a large library without any AI cost` spends 251ms on 200 sequential IndexedDB writes to assert one integer, and never checks the AI invariant it is named for

### src/features/review/reviewQueue.test.tsx (2)
- [ ] `type-safety/F073` L10 — The probe binds to an inferred hook contract in which current: queue[0] is typed ReviewCard, not ReviewCard | undefined
- [ ] `test-efficiency/F044` L131 — Two tests in jsdom/Testing-Library files never render and never touch the hook under test — they are repo tests parked in the React tier

### src/features/settings/useTheme.test.tsx (2)
- [ ] `type-safety/F132` L15 — The theme union is re-declared inline instead of importing ThemeChoice
- [ ] `type-safety/F075` L26 — vi.stubGlobal erases the matchMedia type, and the hand-built stub never fires a change event

### src/lib/ai/prompts.ts (2)
- [ ] `type-safety/F078` L39 — User-controlled book titles are interpolated raw into the prompt that defines the requested output shape
- [ ] `S200` L45 — Question count and option count are specified only in prose

### src/lib/audio/wav.ts (2)
- [ ] `type-safety/F082` L12 — pcmToWavBlob stamps a hardcoded 24kHz/mono/16-bit header on unvalidated Gemini bytes while discarding the mimeType the API actually returns
- [ ] `S035` L29 — Odd-length PCM is written as a valid 16-bit stream

### src/lib/contrast.ts (2)
- [ ] `type-safety/F083` L8 — relativeLuminance accepts any string and returns NaN or a plausible wrong number, defeating the project's own WCAG guardrail
- [ ] `feature-discovery/F058` L25 — The WCAG contrast engine has zero runtime consumers; the placeholder cover is hardcoded orange because nothing checks contrast at runtime

### src/lib/download.test.ts (2)
- [ ] `type-safety/F087` L1 — download.test.ts covers only slugify; downloadText has no return annotation and cannot run under the current harness
- [ ] `test-efficiency/F019` L2 — `slugify` string tests (14.7 ms) pay a jsdom boot for DOM APIs the file never reaches — `downloadText` is never called

### src/test/setup.ts (2)
- [ ] `type-safety/F101` L11 — setup.ts provides no typed fetch stub, so four hand-rolled stubs diverge from typeof fetch and one leaks across tests
- [ ] `test-efficiency/F022` L17 — The global setup file is unconditionally DOM- and localStorage-bound, so the cheap per-file `// @vitest-environment node` escape hatch cannot be used without crashing every file that tries it

### src/test/smoke.test.tsx (2)
- [ ] `test-efficiency/F031` L4 — `import App` drags 1.02 MB of @google/genai into both workers, and neither file ever constructs a client
- [ ] `type-safety/F102` L58 — The 'no Gemini call on boot' invariant is asserted by a for-loop that runs zero times when nothing is captured

### index.html (1)
- [ ] `S182` L6 — No Open Graph or social preview metadata

### package.json (1)
- [ ] `test-efficiency/F042` L14 — No fast-tier test script: `npm test` is all-or-nothing across 24 jsdom files, and `test:smoke` pays a full per-file boot for one file

### README.md (1)
- [ ] `S140` L74 — README forward-references packaging that does not exist yet

### src (1)
- [ ] `S136` L1 — NEGATIVE RESULT — no scar tissue found

### src/app (1)
- [ ] `S137` L1 — NEGATIVE RESULT — layering is proportionate

### src/app/routes.tsx (1)
- [ ] `type-safety/F116` L19 — Route paths and param names are bare strings with no compile-time link to their navigation consumers

### src/components/BookDetail.test.tsx (1)
- [ ] `test-efficiency/F011` L55 — BookDetail > 'offers Chat and Quiz for a book that has a summary' costs 939 ms to assert two buttons exist [IMPORT]

### src/components/ChatModal.test.tsx (1)
- [ ] `test-efficiency/F035` L5 — ChatModal.test.tsx's @google/genai cascade is unavoidable — the subject under test pulls the SDK itself, so L03's remedy does not apply here

### src/components/ChatModal.tsx (1)
- [ ] `file-decomposition/F003` L116 — Icon-only close buttons in ChatModal and QuizModal have no accessible name

### src/components/QuizModal.tsx (1)
- [ ] `S063` L52 — Review cards are written one awaited transaction at a time

### src/components/ui/ConfirmDialog.tsx (1)
- [ ] `type-safety/F062` L19 — Pending-confirm state is split across a nullable state field and a nullable ref that the types never tie together, so `Promise<boolean>` can hang forever

### src/components/ui/useFocusTrap.ts (1)
- [ ] `type-safety/F126` L25 — `document.activeElement as HTMLElement | null` asserts a `.focus()` method onto a base `Element`

### src/features/book/BookDetailPage.tsx (1)
- [ ] `S157` L51 — onOpenReader declares a Book parameter its implementation ignores

### src/features/book/useBookRoute.ts (1)
- [ ] `S158` L21 — A failed summary lookup is indistinguishable from having no summary

### src/features/library/useLibrary.test.tsx (1)
- [ ] `test-efficiency/F039` L67 — PDF blob test allocates and structured-clones 10 MB when ~64 KB proves the same invariant

### src/features/library/useLibrary.tsx (1)
- [ ] `type-safety/F131` L128 — The 'no active profile' precondition is unrepresentable in the mutators' return types, and is reported to the user as success

### src/features/profile/ProfileContext.test.tsx (1)
- [ ] `test-efficiency/F028` L41 — `selects a newly created profile and persists the selection` is 569ms — the lot's slowest test and 59% of its file's body time

### src/features/profile/ProfileContext.tsx (1)
- [ ] `S020` L62 — selectProfile silently no-ops on an unknown id

### src/features/profile/ProfilePicker.tsx (1)
- [ ] `S167` L45 — Duplicate profile names are indistinguishable

### src/features/settings/ApiKeyDialog.tsx (1)
- [ ] `S169` L66 — Key-error banner is light-only

### src/features/settings/useTheme.ts (1)
- [ ] `type-safety/F133` L16 — An unvalidated Profile.theme from IndexedDB is annotated into a three-literal union it may not belong to

### src/features/stats/StatsPage.tsx (1)
- [ ] `type-safety/F134` L6 — StatsPage destructures books without isLoading, so an unloaded library is typed identically to an empty one

### src/lib/ai/apiKey.test.ts (1)
- [ ] `test-efficiency/F014` L10 — apiKey.test.ts loads the real @google/genai SDK (1.04 MB / 227 modules) for three tests that only need a stub constructor

### src/lib/ai/client.ts (1)
- [ ] `feature-discovery/F060` L12 — The client hardcodes Google's endpoint — one `httpOptions.baseUrl` setting would let a local-first app talk to a local model

### src/lib/ai/errors.test.ts (1)
- [ ] `test-efficiency/F029` L1 — errors.test.ts is 100% pure-function (29.6 ms of tests) yet pays a full jsdom environment + fake-indexeddb setup per file

### src/lib/ai/errors.ts (1)
- [ ] `S139` L30 — Two error messages point at a Settings screen that does not exist

### src/lib/ai/tts.ts (1)
- [ ] `feature-discovery/F061` L21 — TTS runs single-speaker over a concatenated string — the model and SDK support a two-host dialogue and no script is ever written

### src/lib/base64.ts (1)
- [ ] `type-safety/F136` L17 — Redundant `bytes[i] as number` pre-suppresses exactly the check noUncheckedIndexedAccess would add

### src/lib/covers/index.test.ts (1)
- [ ] `type-safety/F038` L5 — mockFetch types every API fixture as unknown, so no fixture is checked against the as-asserted response shapes

### src/lib/covers/openLibrary.ts (1)
- [ ] `type-safety/F137` L8 — Truthy check on a numeric cover id conflates absent with zero

### src/lib/covers/placeholder.ts (1)
- [ ] `feature-discovery/F062` L12 — Every generated placeholder cover is the same hardcoded orange, making a placeholder-heavy library grid unscannable

### src/lib/goodreads.test.ts (1)
- [ ] `type-safety/F088` L95 — coverForIsbn is tested with one perfect ISBN and undefined, so unvalidated ISBN text becomes Book.coverImageUrl

### src/lib/markdown.test.ts (1)
- [ ] `type-safety/F039` L20 — Summary fixture always supplies real arrays, so the one consumer that would crash on an AI-shaped Summary is never exercised

### src/lib/markdown.ts (1)
- [ ] `S181` L9 — Markdown export does not escape special characters in user or model text

### src/lib/srs.test.ts (1)
- [ ] `type-safety/F091` L97 — dueAt is a bare string compared numerically by isDue and lexically by repo.listDue, and nothing cross-checks them

### src/lib/storage/libraryExport.test.ts (1)
- [ ] `test-efficiency/F030` L1 — Pure-function `libraryExport.test.ts` is forced through jsdom + fake-indexeddb + Testing Library boot it never uses

### vite.config.ts (1)
- [ ] `test-efficiency/F023` L20 — 20s testTimeout/hookTimeout is 75x the slowest test in the suite — it is sized for the per-file boot cost, not for any assertion, and it converts a broken fixture into ~11 minutes of dead wall-clock
