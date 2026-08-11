# BookSum Overhaul — Design

**Date:** 2026-08-11
**Status:** Approved, ready for implementation planning
**Source:** Google AI Studio export (`booksum---ai-book-summarizer-&-tracker`), imported verbatim as the baseline commit.

---

## 1. Goal

Take a working-in-spirit AI Studio export and turn it into a repository someone can clone, run, understand, and contribute to — then publish it publicly under MIT.

Three things have to become true:

1. `git clone && npm install && npm run dev` works on a clean machine.
2. Nobody's API key is exposed by running or deploying it.
3. The code is structured, tested, and documented well enough that a stranger can land a pull request.

## 2. Baseline defects

Verified against the source, not inferred.

| # | Defect | Evidence |
|---|--------|----------|
| 1 | Does not install | `package.json` pins `@google/genai@^0.1.1`; no version in `[0.1.1, 0.2.0)` exists on npm (404). Published versions start at `0.2.0`. |
| 2 | API key ships to the browser | `vite.config.ts:13` — `define: { 'process.env.API_KEY': JSON.stringify(env.API_KEY) }` inlines the key into the bundle. |
| 3 | Key never resolves anyway | README instructs setting `GEMINI_API_KEY`; `vite.config.ts` reads `API_KEY`. Resolves to `''`. |
| 4 | Two dependency universes | `package.json`: React 18 + genai 0.1.1. `index.html` importmap: React 19 + genai 1.35. Code uses 1.x APIs (`Modality`, `ai.chats.create`). |
| 5 | Plaintext passwords persisted | `contexts/AuthContext.tsx:86-95` writes `password` into `localStorage` key `booksum_db_users`. |
| 6 | Storage exceeds quota | `types.ts:37-38` — `audioData` (base64 WAV) and `pdfData` (base64 PDF) live inside each book record; the whole array is serialised to `localStorage` on every change (`App.tsx:209-214`). A single 10MB PDF exceeds the ~5MB origin quota; `setItem` throws and persistence stops. |
| 7 | Unprompted API spend | `App.tsx:152-177` — a 3s-debounced effect calls `getAIRecommendations` after *any* library change including first load; each call fans out 6 cover lookups. |
| 8 | Wasteful cover lookup | `services/geminiService.ts:78-110` — third fallback spends an image-model call with the search tool, then regexes a URL out of prose. |
| 9 | Dead profile setting | `UserProfile.favoriteVoice` is settable; `geminiService.ts:303` hardcodes `voiceName: 'Kore'`. |
| 10 | No routing | View is `useState<ViewState>`. Browser back does nothing; no view is linkable. |
| 11 | `App.tsx` does too much | 700 lines: routing, state, persistence, layout, recommendations carousel, daily-wisdom scheduling. |
| 12 | Generic error handling | Every AI failure becomes one string (`AddBookModal.tsx:55`); `alert()` / `confirm()` used for UX (`App.tsx:256, 263, 280`). |
| 13 | Inaccessible modals | Five modals, none with focus trap, Escape handling, focus restore, or `aria-modal`. |
| 14 | Tailwind from CDN | `index.html:9` — `cdn.tailwindcss.com`, which Tailwind documents as development-only. No purge, no build. |
| 15 | No tests, lint, CI, LICENSE, or `.gitignore` | — |

## 3. Stack

| Concern | Choice | Note |
|---|---|---|
| Build | Vite 7 | |
| UI | React 19 | Matches what the importmap already implied |
| Language | TypeScript 5.x, `strict` | |
| Styling | Tailwind v4 via `@tailwindcss/vite` | Replaces the CDN; enables dark mode + purge |
| AI | `@google/genai@^2.x` | Current major |
| Routing | `react-router` | Fixes back button and deep links |
| Storage | `idb` over IndexedDB | ~1KB wrapper; removes a class of raw-IDB bugs |
| Tests | Vitest, Testing Library, `fake-indexeddb`, jsdom | |
| Quality | ESLint 9 flat config, typescript-eslint, Prettier | |
| PWA | `vite-plugin-pwa` | Installable, offline shell |

## 4. Structure

```
src/
  main.tsx
  app/
    App.tsx              # shell only (~80 lines)
    routes.tsx
    ErrorBoundary.tsx
  features/
    library/             # LibraryPage, BookCard, filters, useLibrary
    book/                # BookDetailPage, EReaderPage, ChatPanel, QuizPanel
    add-book/            # AddBookDialog: search | PDF | Goodreads CSV
    review/              # spaced-repetition queue
    stats/               # StatsPage
    profile/             # ProfilePage, ProfilePicker
    settings/            # ApiKeyDialog, theme toggle
  lib/
    ai/                  # client, prompts, schemas, summarize, chat, quiz, tts, recommend, errors
    covers/              # googleBooks, openLibrary, placeholder, index (fallback chain)
    storage/             # db, repo, migrate
    audio/wav.ts
    goodreads/parse.ts
    srs.ts
  components/ui/         # Dialog, Button, Field, Toast, ConfirmDialog
  types.ts
```

Each unit answers: what it does, how it is used, what it depends on. `lib/` has no React imports; `features/` has no direct IndexedDB or genai imports — both go through `lib` interfaces so they can be faked in tests.

## 5. Data model

`BookInsight` currently forces every book to carry a full AI summary. This is what makes bulk import impossible: 300 imported Goodreads rows would mean 300 Gemini calls.

Split into two entities:

```ts
interface Book {
  id: string;                    // crypto.randomUUID()
  profileId: string;
  title: string;
  author: string;
  category: Category;
  status: 'Finished' | 'Want to Read';
  priority?: Priority;
  rating: number;
  personalNotes?: string;
  coverImageUrl: string;
  addedAt: string;
  finishedAt?: string;
  summaryId?: string;            // absent = not yet summarised
  hasPdf: boolean;               // bytes live in `blobs`
}

interface Summary {
  id: string;
  bookId: string;
  oneSentenceTakeaway: string;
  summary: string;
  keyInsights: string[];
  actionableSteps: string[];
  detailedSummary?: string;
  readingTimeMinutes: number;
  generatedAt: string;
  model: string;
}
```

Consequences: "Want to Read" entries cost nothing, imports are instant, and summaries are generated on demand when a book is opened.

## 6. Storage

IndexedDB accessed only through a typed `repo.ts`. Four object stores:

| Store | Key | Contents |
|---|---|---|
| `profiles` | `id` | name, bio, monthlyGoal, favoriteVoice, theme, createdAt |
| `books` | `id` | `Book` records, indexed by `profileId` |
| `summaries` | `id` | `Summary` records, indexed by `bookId` |
| `blobs` | `bookId:kind` | real `Blob`s — `pdf`, `audio-short`, `audio-long` |
| `reviewCards` | `id` | SRS cards, indexed by `profileId` and `dueAt` |

Binary data is never base64 inside a record. Writes are per-entity, not whole-array rewrites.

**Migration.** On first boot, `migrate.ts` reads any `booksum_library_*`, `booksum_profile_*`, `booksum_recs_*` localStorage keys, splits each legacy `BookInsight` into `Book` + `Summary`, decodes `pdfData` / `audioData` into `blobs`, and writes a `booksum.migratedAt` marker. Non-destructive: legacy keys are left in place. Idempotent.

## 7. Authentication → local profiles

The password system is deleted. `LoginView` becomes a "Who's reading?" profile picker: pick an existing profile or create one with a name. Profiles are rows in the `profiles` store; the selected `profileId` is held in `localStorage` under `booksum.activeProfile` and scopes every query.

No passwords, no sessions, no security claims. The existing per-user data namespacing is preserved by `profileId`, so the migration maps cleanly.

## 8. BYOK (bring your own key)

The `define` block in `vite.config.ts` is deleted. No key is ever inlined into the bundle.

The user's Gemini key is stored in `localStorage` under `booksum.apiKey` — it is their own key, on their own machine, for their own origin. `lib/ai/client.ts` constructs `GoogleGenAI` per call from that value and throws a typed `MissingKeyError` when it is absent.

**No key does not mean a dead app.** These work with zero key: profiles, library CRUD, notes, reading, Goodreads import, search, stats, Markdown export, review queue, dark mode, PWA install. Only these gate: summarise, detailed summary, chat, quiz generation, TTS, recommendations.

Any gated action opens `ApiKeyDialog`, which explains what the key is for, links to `aistudio.google.com/apikey`, and states plainly that the key stays in this browser and is sent only to Google. A first-run screen says the same in two sentences. The key field offers a "test key" button that makes one trivial call and reports the result.

## 9. AI layer

**Streaming.** `generateContentStream` for the detailed "masterclass" summary and for chat — both are free-form text and render incrementally. The structured calls (summary, quiz, recommendations) use `responseSchema` and cannot render partially; they get determinate progress states instead, not fake streaming.

**Typed errors.** `lib/ai/errors.ts` maps failures to a discriminated union — `MissingKey`, `InvalidKey` (401/403), `RateLimited` (429), `QuotaExhausted`, `SafetyBlocked`, `NetworkError`, `MalformedResponse`, `Unknown` — each with a specific user-facing message and, where applicable, a retry affordance. Replaces the single catch-all string.

**Covers.** Chain becomes Google Books → OpenLibrary → locally generated SVG data-URI placeholder. The Gemini image-model search step is removed (cost, latency, unreliability) and so is the `ui-avatars.com` dependency. Results are cached in IndexedDB keyed by normalised `title|author`.

**Recommendations.** No automatic effect. An explicit refresh button plus a 24h cache keyed by library fingerprint. Zero AI calls on load.

**Voice.** `generateAudioSummary` reads `profile.favoriteVoice` instead of hardcoding `'Kore'`.

**Models.** Model IDs are centralised in `lib/ai/models.ts` so a rename is a one-line change rather than a grep across the codebase.

## 10. Accessibility and UI states

- One `Dialog` primitive: focus trap, Escape to close, focus restore on unmount, `aria-modal`, `aria-labelledby`. All five modals migrate.
- `alert()` → toast; `confirm()` → `ConfirmDialog`.
- Route-level `ErrorBoundary` with a recover action.
- Recommendations carousel: arrow-key navigation, and the hover-only preview card gets a `:focus-visible` equivalent so it is reachable by keyboard.
- Contrast pass. `text-orange-600` on `#fcfcf9` measures ≈3.9:1 — below AA for the small uppercase labels it is used on. Darkened to a token that passes.
- Every async surface gets explicit loading, empty, and error states.

## 11. New capability

| Feature | Design |
|---|---|
| Dark mode | Tailwind v4 `@custom-variant dark`. Follows system by default; manual override persists per profile. |
| Full-text search | Client-side index over title, author, summary, insights, steps, and personal notes. Currently title/author only. |
| Markdown export | Per book and whole library. Deterministic output, snapshot-tested. |
| ⌘K palette | Navigate, search books, add book, toggle theme, start review. |
| Goodreads import | Parses the official CSV export. `Exclusive Shelf` → status (`read`→Finished, `to-read`→Want to Read), `My Rating` → rating, ISBN13 → cover lookup. **Zero AI calls.** Dry-run preview with a duplicate report before committing. |
| PWA | `vite-plugin-pwa`, offline app shell, installable, cached covers. |
| Spaced repetition | Generated quiz questions become `reviewCards` with SM-2-lite scheduling (`ease`, `interval`, `dueAt`; grades 1–4). A Review route surfaces cards due across all books. `srs.ts` is pure and fully unit-tested. |

## 12. Testing

Per global rules: unit and integration by default, no E2E unless requested.

**Unit** — SRS scheduling transitions, Goodreads CSV parsing (including quoted commas and missing columns), WAV header encoding, cover fallback chain, library filter/sort, storage migration, AI error mapping, Markdown export snapshots.

**Integration** (Testing Library + `fake-indexeddb` + mocked genai) — add a book end to end; PDF upload stores a Blob and does not bloat the record; switching profiles isolates libraries; a missing key gates AI actions and opens the dialog; the review queue advances and reschedules; migration from legacy localStorage produces the expected entities.

**Smoke** (`smoke.test.ts`, under 30s) — app boots, profile picker renders, library renders, a dialog opens and closes, IndexedDB initialises.

Tests do not assert what the type system already enforces.

## 13. CI and deployment

`.github/workflows/ci.yml` — typecheck, lint, test, build on push and PR.
`.github/workflows/deploy.yml` — build and publish to GitHub Pages on `main`.

`npm run build` runs `tsc --noEmit` before `vite build`, so a type error fails the build rather than shipping.

## 14. Open-source packaging

Added: `LICENSE` (MIT), `README.md` (what it is, screenshots, BYOK setup, run/build/deploy, architecture overview, privacy note), `CONTRIBUTING.md`, `SECURITY.md`, `.gitignore`, `.github/ISSUE_TEMPLATE/`, `.env.example`.

Removed: `metadata.json` (AI Studio manifest), the AI Studio banner and app link in the README, and the `noindex` meta tag in `index.html`.

Repo: `dorianspitz23/booksum`, public, MIT, with topics and a live Pages demo link. Pushed only after review.

## 15. Build order

Each phase ends in a verifiable state.

**Phase 1 — Foundation.** Dependencies resolve and install; Tailwind build replaces the CDN; `vite.config.ts` define block removed; IndexedDB + repo + migration; profiles replace auth; BYOK dialog and gating. *Verify:* clean clone installs, builds, runs; no key appears in `dist/`; adding a 10MB PDF does not break persistence.

**Phase 2 — Quality.** `App.tsx` decomposition; routing; Dialog primitive and modal migration; typed AI errors; toasts; error boundary; contrast and keyboard fixes; test suite; CI. *Verify:* CI green; a11y checks pass on every modal; back button works.

**Phase 3 — Features.** Dark mode, full-text search, Markdown export, ⌘K palette, Goodreads import, PWA, spaced repetition. *Verify:* each feature has tests; PWA installs; import of a real Goodreads CSV makes zero network calls to Gemini.

**Phase 4 — Publish.** README with real screenshots, LICENSE, CONTRIBUTING, SECURITY, templates; final secret scan of the full git history; public repo; Pages deploy. *Verify:* `git log -p | grep` finds no key material; the Pages demo loads and prompts for a key.

## 16. Out of scope

- Backend, hosted accounts, cloud sync — deliberately rejected; this stays local-first so contributors and users pay nothing.
- E2E tests — available on request.
- Rewriting the visual design. The existing look is good; it gets a contrast pass and dark mode, not a redesign.
