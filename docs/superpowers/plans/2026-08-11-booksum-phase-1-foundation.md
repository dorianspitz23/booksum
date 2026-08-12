# BookSum Phase 1 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make BookSum installable, buildable, and runnable on a clean machine with no API key baked into the bundle, backed by IndexedDB instead of localStorage, with local profiles replacing the fake password auth.

**Architecture:** All source moves under `src/`. A new `src/lib/` holds React-free modules (storage, AI, covers, audio); `src/features/` holds React code that talks to them through typed interfaces. The Gemini key is supplied by the user at runtime and stored in `localStorage`; `vite.config.ts` never sees it. Book records hold no binary data — PDFs and generated audio live as real `Blob`s in a separate IndexedDB store.

**Tech Stack:** Vite 8 · React 19 · TypeScript 6 · Tailwind v4 (`@tailwindcss/vite`) · `@google/genai` 2.x · `idb` 8 · Vitest 4 + Testing Library + `fake-indexeddb`

**Source spec:** `docs/superpowers/specs/2026-08-11-booksum-overhaul-design.md`

## Global Constraints

Every task's requirements implicitly include this section.

- **No key in the bundle.** `vite.config.ts` must contain no `define` entry for any key. Verified by grepping `dist/` for `AIza`.
- **No binary data inside records.** PDFs and audio are `Blob`s in the `blobs` store, never base64 strings on a `Book`.
- **Layering.** `src/lib/**` must not import React. `src/features/**` and `src/components/**` must not import `idb` or `@google/genai` directly — they go through `src/lib/storage/repo.ts` and `src/lib/ai/*`.
- **Model IDs live only in `src/lib/ai/models.ts`.** Values are carried over verbatim from the working export: `gemini-3-flash-preview` (summary, quiz, chat, recommendations), `gemini-3-pro-preview` (detailed summary), `gemini-2.5-flash-preview-tts` (audio).
- **Node `>=20.19`.**
- **Exact dependency versions** are in Task 1. `@google/genai@^2.16.0` — verified 2026-08-11 to export `Type`, `Modality`, `ApiError` (with numeric `status`), `ai.models.generateContent`, `ai.models.generateContentStream`, `ai.chats.create`, `chat.sendMessageStream`. `lucide-react@^1.31.0` — verified to still export all 63 icons this app imports.
- **Every commit leaves `npm run typecheck` and `npm test` green.**
- **No new `alert()` or `confirm()`.** Existing ones in `App.tsx` stay until Phase 2 replaces them with toasts.
- **No E2E tests.** Unit and integration only.

## Deferred to later phases

Do not do these here: ESLint/Prettier/CI (Phase 2), `react-router` (Phase 2), `App.tsx` decomposition and the `features/` reorganization of existing components (Phase 2), accessible `Dialog` primitive and toasts (Phase 2), streamed detailed summaries and chat via `generateContentStream` (Phase 2 — it pairs with the loading-state work), dark mode / search / export / palette / Goodreads / PWA / spaced repetition (Phase 3), README screenshots and publishing (Phase 4).

Phase 1 moves existing components to `src/components/` **verbatim**, changing import paths only. This keeps the diff reviewable: new foundation plus a mechanical move, rather than everything at once.

---

## File Structure

| File                                      | Responsibility                                                                              |
| ----------------------------------------- | ------------------------------------------------------------------------------------------- |
| `package.json`                            | Real, resolvable dependencies and scripts                                                   |
| `tsconfig.json`                           | Single strict config covering `src` and `vite.config.ts`                                    |
| `vite.config.ts`                          | React + Tailwind plugins, Vitest config. **No `define`.**                                   |
| `index.html`                              | Entry document. No importmap, no Tailwind CDN, no `noindex`                                 |
| `public/favicon.svg`                      | Extracted from the old inline data URI                                                      |
| `src/index.css`                           | Tailwind import + `@theme` tokens + base styles                                             |
| `src/main.tsx`                            | React root, providers                                                                       |
| `src/types.ts`                            | `Profile`, `Book`, `Summary`, `StoredBlob`, `ReviewCard`, enums                             |
| `src/lib/base64.ts`                       | `base64ToBytes`, `bytesToBase64`                                                            |
| `src/lib/storage/db.ts`                   | IndexedDB schema, singleton connection, test reset                                          |
| `src/lib/storage/repo.ts`                 | Typed CRUD: `profiles`, `books`, `summaries`, `blobs`. The only module that touches `db.ts` |
| `src/lib/storage/migrate.ts`              | One-time non-destructive localStorage → IndexedDB migration                                 |
| `src/lib/ai/models.ts`                    | Model ID constants                                                                          |
| `src/lib/ai/apiKey.ts`                    | BYOK read/write/subscribe                                                                   |
| `src/lib/ai/client.ts`                    | `GoogleGenAI` factory bound to the stored key                                               |
| `src/lib/ai/errors.ts`                    | `AiError` union + `toAiError` mapping                                                       |
| `src/lib/ai/schemas.ts`                   | Response schemas                                                                            |
| `src/lib/ai/prompts.ts`                   | Prompt templates                                                                            |
| `src/lib/ai/summarize.ts`                 | `summarizeBook`, `summarizePdf`, `generateDetailedSummary`                                  |
| `src/lib/ai/quiz.ts`                      | `generateBookQuiz`                                                                          |
| `src/lib/ai/chat.ts`                      | `createBookChatSession`                                                                     |
| `src/lib/ai/tts.ts`                       | `generateAudioSummary` (honours `profile.favoriteVoice`)                                    |
| `src/lib/ai/recommend.ts`                 | `getAIRecommendations`                                                                      |
| `src/lib/covers/googleBooks.ts`           | Google Books cover lookup                                                                   |
| `src/lib/covers/openLibrary.ts`           | OpenLibrary cover lookup                                                                    |
| `src/lib/covers/placeholder.ts`           | Locally generated SVG data URI                                                              |
| `src/lib/covers/index.ts`                 | Fallback chain                                                                              |
| `src/lib/audio/wav.ts`                    | PCM → WAV `Blob`                                                                            |
| `src/features/profile/ProfileContext.tsx` | Active profile state                                                                        |
| `src/features/profile/ProfilePicker.tsx`  | "Who's reading?" screen                                                                     |
| `src/features/settings/ApiKeyDialog.tsx`  | BYOK entry + test-key button                                                                |
| `src/features/library/useLibrary.ts`      | Library state bound to the repo                                                             |
| `src/test/setup.ts`                       | Vitest global setup                                                                         |

Deleted: `metadata.json`, `tsconfig.node.json`, `contexts/AuthContext.tsx`, `components/LoginView.tsx`, `services/geminiService.ts`.

---

## Task 1: Toolchain, layout, and build

Makes the project install, typecheck, test, and build. Nothing else in this plan can start until this is green.

**Files:**

- Modify: `package.json`, `index.html`, `vite.config.ts`, `tsconfig.json`
- Create: `src/index.css`, `src/test/setup.ts`, `src/test/smoke.test.tsx`, `public/favicon.svg`
- Move: all `.tsx`/`.ts` sources into `src/`
- Delete: `tsconfig.node.json`, `metadata.json`

**Interfaces:**

- Consumes: nothing
- Produces: working `npm run dev|build|typecheck|test`; all app source importable from `src/`

- [ ] **Step 1: Write the smoke test**

Create `src/test/smoke.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

function Hello() {
  return <h1>BookSum</h1>;
}

describe('toolchain', () => {
  it('renders a React component in jsdom', () => {
    render(<Hello />);
    expect(screen.getByRole('heading', { name: 'BookSum' })).toBeInTheDocument();
  });

  it('exposes indexedDB to tests', () => {
    expect(globalThis.indexedDB).toBeDefined();
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test`
Expected: FAIL — `vitest` is not installed (`npm error could not determine executable to run`).

- [ ] **Step 3: Replace `package.json`**

```json
{
  "name": "booksum",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=20.19" },
  "scripts": {
    "dev": "vite",
    "build": "npm run typecheck && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:smoke": "vitest run src/test/smoke.test.tsx"
  },
  "dependencies": {
    "@google/genai": "^2.16.0",
    "idb": "^8.0.3",
    "lucide-react": "^1.31.0",
    "react": "^19.2.8",
    "react-dom": "^19.2.8"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.3.3",
    "@testing-library/jest-dom": "^7.0.1",
    "@testing-library/react": "^16.3.2",
    "@testing-library/user-event": "^14.6.3",
    "@types/react": "^19.2.18",
    "@types/react-dom": "^19.2.4",
    "@vitejs/plugin-react": "^6.0.5",
    "fake-indexeddb": "^6.2.5",
    "jsdom": "^30.0.1",
    "tailwindcss": "^4.3.3",
    "typescript": "^6.0.3",
    "vite": "^8.2.1",
    "vitest": "^4.1.10"
  }
}
```

- [ ] **Step 4: Move all sources under `src/`**

```bash
mkdir -p src/components src/contexts src/services
git mv App.tsx types.ts src/
git mv index.tsx src/main.tsx
git mv components/*.tsx src/components/
git mv contexts/AuthContext.tsx src/contexts/
git mv services/geminiService.ts src/services/
rmdir components contexts services
git rm -q tsconfig.node.json metadata.json
```

Relative imports inside `src/components/*` and `src/contexts/*` already resolve (`../types`, `../services/geminiService`) because the directory depth is unchanged. `src/App.tsx` and `src/main.tsx` also keep working (`./types`, `./components/...`). No import edits are needed in this step — Step 12 verifies that with `tsc`.

- [ ] **Step 5: Replace `tsconfig.json` and delete the node variant**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src", "vite.config.ts"]
}
```

`noUncheckedIndexedAccess` is deliberately left off — it is a Phase 2 tightening, so this task does not turn into an unbounded fix-up.

- [ ] **Step 6: Replace `vite.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// NOTE: there is deliberately no `define` block here.
// The Gemini API key is supplied by the user at runtime (see src/lib/ai/apiKey.ts)
// and must never be inlined into the bundle. See docs/superpowers/specs/.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    restoreMocks: true,
  },
});
```

- [ ] **Step 7: Create `src/index.css`**

```css
@import 'tailwindcss';

@theme {
  --font-sans: 'Inter', ui-sans-serif, system-ui, sans-serif;
  --font-serif: 'Playfair Display', ui-serif, Georgia, serif;
  --color-parchment: #fcfcf9;
}

@layer base {
  body {
    font-family: var(--font-sans);
    background-color: var(--color-parchment);
  }
}
```

The `--font-serif` token makes the existing `font-serif` utility resolve to Playfair Display, so no markup changes are needed.

- [ ] **Step 8: Extract the favicon**

Create `public/favicon.svg` with the SVG that was inline in `index.html`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="25" fill="#ea580c"/>
  <text x="50" y="50" font-family="serif" font-weight="bold" font-style="italic"
        font-size="60" fill="white" text-anchor="middle" dominant-baseline="central">B</text>
</svg>
```

- [ ] **Step 9: Replace `index.html`**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>BookSum — AI book summaries, audio, and review</title>
    <meta
      name="description"
      content="Turn any book into a summary, key insights, audio, and a quiz. Local-first, bring your own Gemini key."
    />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:ital,wght@0,700;1,700&display=swap"
      rel="stylesheet"
    />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Removed: the `<script type="importmap">` block, the `cdn.tailwindcss.com` script, `<meta name="robots" content="noindex">`, and the inline `<style>`.

- [ ] **Step 10: Import the stylesheet in `src/main.tsx`**

Add as the first import of `src/main.tsx`:

```tsx
import './index.css';
```

- [ ] **Step 11: Create `src/test/setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
  localStorage.clear();
});
```

- [ ] **Step 12: Install and run the full gate**

```bash
npm install
npm run typecheck
npm test
npm run build
```

Expected: all four succeed. `npm test` passes both smoke assertions.

Two failures are expected here and are fixed in this step, not deferred:

1. `src/services/geminiService.ts:5` — `process.env.API_KEY` does not typecheck (no Node types, and the `define` block is gone). Replace line 5 with a lazy accessor so the module still loads without a key:

```ts
import { GoogleGenAI, Type, Modality, type Chat } from '@google/genai';

let client: GoogleGenAI | null = null;
const ai = {
  get models() {
    return getClient().models;
  },
  get chats() {
    return getClient().chats;
  },
};

function getClient(): GoogleGenAI {
  if (!client) {
    const key = localStorage.getItem('booksum.apiKey');
    if (!key) throw new Error('Missing Gemini API key');
    client = new GoogleGenAI({ apiKey: key });
  }
  return client;
}
```

This is a deliberate temporary shim — Task 6 replaces it with `src/lib/ai/client.ts`. It exists so the app compiles and runs at the end of this task instead of only at the end of the phase.

2. `GenerateContentResponse` is imported but unused in `geminiService.ts:2`, which `noUnusedLocals` now rejects. Delete it from the import list.

- [ ] **Step 13: Verify no key can reach the bundle**

```bash
npm run build
grep -rn "AIza" dist/ ; echo "grep exit: $?"
```

Expected: no matches, `grep exit: 1`.

- [ ] **Step 14: Commit**

```bash
git add -A
git commit -m "build: replace AI Studio toolchain with a real Vite 8 + React 19 setup

- Resolvable dependency tree (the old @google/genai@^0.1.1 does not exist on npm)
- Remove the vite define block that inlined the API key into the bundle
- Remove the Tailwind CDN and the React importmap; Tailwind v4 now builds
- Move all sources under src/, add Vitest + Testing Library + fake-indexeddb
- Drop metadata.json and the noindex meta tag"
```

---

## Task 2: IndexedDB storage layer

**Files:**

- Create: `src/lib/storage/db.ts`, `src/lib/storage/repo.ts`, `src/lib/storage/repo.test.ts`, `src/lib/base64.ts`
- Modify: `src/types.ts`

**Interfaces:**

- Consumes: nothing from Task 1 beyond the toolchain
- Produces:
  - `getDb(): Promise<IDBPDatabase<BookSumDB>>`, `resetDb(): Promise<void>` from `db.ts`
  - From `repo.ts`: `profiles.list()`, `profiles.get(id)`, `profiles.create({name})`, `profiles.update(p)`, `profiles.remove(id)`; `books.listByProfile(profileId)`, `books.get(id)`, `books.create(input)`, `books.update(b)`, `books.remove(id)`; `summaries.getByBook(bookId)`, `summaries.upsert(s)`, `summaries.remove(id)`; `blobs.put(bookId, kind, blob)`, `blobs.get(bookId, kind)`, `blobs.removeByBook(bookId)`
  - From `types.ts`: `Profile`, `Book`, `Summary`, `StoredBlob`, `BlobKind`, `ReviewCard`, `BookStatus`, `Priority`, `VoiceName`, `Category`

- [ ] **Step 1: Rewrite `src/types.ts`**

```ts
export type BookStatus = 'Finished' | 'Want to Read';
export type Priority = 'Low' | 'Medium' | 'High';
export type VoiceName = 'Kore' | 'Puck' | 'Zephyr' | 'Charon' | 'Fenrir';
export type BlobKind = 'pdf' | 'audio-short' | 'audio-long';

export enum Category {
  PSYCHOLOGY = 'Psychology',
  PRODUCTIVITY = 'Productivity',
  BUSINESS = 'Business',
  TECHNOLOGY = 'Technology',
  PHILOSOPHY = 'Philosophy',
  HEALTH = 'Health',
  BIOGRAPHY = 'Biography',
  OTHER = 'Other',
}

export interface Profile {
  id: string;
  name: string;
  bio: string;
  monthlyGoal: number;
  favoriteVoice: VoiceName;
  theme: 'system' | 'light' | 'dark';
  createdAt: string;
}

/** A book in the library. Carries no binary data and no summary text. */
export interface Book {
  id: string;
  profileId: string;
  title: string;
  author: string;
  category: string;
  status: BookStatus;
  priority?: Priority;
  rating: number;
  personalNotes?: string;
  coverImageUrl: string;
  addedAt: string;
  finishedAt?: string;
  /**
   * Minutes to read this book's generated summary. Lives on Book, not Summary,
   * because BookCard and StatsView render it for every book in a list and must
   * not load every summary to do so.
   */
  readingTimeMinutes: number;
  /** Absent until an AI summary has been generated for this book. */
  summaryId?: string;
  hasPdf: boolean;
}

export interface Summary {
  id: string;
  bookId: string;
  oneSentenceTakeaway: string;
  summary: string;
  keyInsights: string[];
  actionableSteps: string[];
  detailedSummary?: string;
  generatedAt: string;
  /** Model ID that produced this, or 'legacy' for migrated records. */
  model: string;
}

export interface StoredBlob {
  /** `${bookId}:${kind}` */
  key: string;
  bookId: string;
  kind: BlobKind;
  blob: Blob;
}

/** Created in the v1 schema so Phase 3 needs no database version bump. */
export interface ReviewCard {
  id: string;
  profileId: string;
  bookId: string;
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
  ease: number;
  intervalDays: number;
  dueAt: string;
  reviewCount: number;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
}
```

- [ ] **Step 2: Write the failing repo test**

Create `src/lib/storage/repo.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from './db';
import { blobs, books, profiles, summaries } from './repo';

beforeEach(async () => {
  await resetDb();
});

async function seedProfile(name = 'Dorian') {
  return profiles.create({ name });
}

function bookInput(profileId: string, overrides: Partial<Parameters<typeof books.create>[0]> = {}) {
  return {
    profileId,
    title: 'Atomic Habits',
    author: 'James Clear',
    category: 'Productivity',
    status: 'Finished' as const,
    rating: 5,
    readingTimeMinutes: 12,
    coverImageUrl: 'https://example.test/cover.jpg',
    hasPdf: false,
    ...overrides,
  };
}

describe('profiles', () => {
  it('creates a profile with defaults and lists it', async () => {
    const created = await seedProfile();
    expect(created.id).toMatch(/[0-9a-f-]{36}/);
    expect(created.monthlyGoal).toBe(4);
    expect(created.favoriteVoice).toBe('Kore');
    expect(created.theme).toBe('system');
    await expect(profiles.list()).resolves.toHaveLength(1);
  });

  it('updates a profile', async () => {
    const p = await seedProfile();
    await profiles.update({ ...p, monthlyGoal: 10 });
    await expect(profiles.get(p.id)).resolves.toMatchObject({ monthlyGoal: 10 });
  });
});

describe('books', () => {
  it('scopes books to their profile', async () => {
    const a = await seedProfile('A');
    const b = await seedProfile('B');
    await books.create(bookInput(a.id));
    await books.create(bookInput(b.id, { title: 'Deep Work' }));

    const forA = await books.listByProfile(a.id);
    expect(forA).toHaveLength(1);
    expect(forA[0]?.title).toBe('Atomic Habits');
  });

  it('assigns an id and addedAt on create', async () => {
    const p = await seedProfile();
    const book = await books.create(bookInput(p.id));
    expect(book.id).toBeTruthy();
    expect(Date.parse(book.addedAt)).not.toBeNaN();
  });
});

describe('cascading deletes', () => {
  it('removes the summary and blobs when a book is removed', async () => {
    const p = await seedProfile();
    const book = await books.create(bookInput(p.id));
    await summaries.upsert({
      id: 'sum-1',
      bookId: book.id,
      oneSentenceTakeaway: 'x',
      summary: 'y',
      keyInsights: [],
      actionableSteps: [],
      generatedAt: new Date().toISOString(),
      model: 'test',
    });
    await blobs.put(book.id, 'pdf', new Blob(['pdf bytes'], { type: 'application/pdf' }));

    await books.remove(book.id);

    await expect(books.get(book.id)).resolves.toBeUndefined();
    await expect(summaries.getByBook(book.id)).resolves.toBeUndefined();
    await expect(blobs.get(book.id, 'pdf')).resolves.toBeUndefined();
  });

  it('removes every book, summary and blob when a profile is removed', async () => {
    const p = await seedProfile();
    const book = await books.create(bookInput(p.id));
    await blobs.put(book.id, 'pdf', new Blob(['x']));

    await profiles.remove(p.id);

    await expect(books.listByProfile(p.id)).resolves.toHaveLength(0);
    await expect(blobs.get(book.id, 'pdf')).resolves.toBeUndefined();
  });
});

describe('blobs', () => {
  it('round-trips a blob without inflating the book record', async () => {
    const p = await seedProfile();
    const book = await books.create(bookInput(p.id, { hasPdf: true }));
    const bytes = new Uint8Array(5 * 1024 * 1024);
    await blobs.put(book.id, 'pdf', new Blob([bytes], { type: 'application/pdf' }));

    const stored = await blobs.get(book.id, 'pdf');
    expect(stored?.size).toBe(bytes.byteLength);

    const reloaded = await books.get(book.id);
    expect(JSON.stringify(reloaded).length).toBeLessThan(1_000);
  });

  it('overwrites a blob of the same kind rather than duplicating it', async () => {
    const p = await seedProfile();
    const book = await books.create(bookInput(p.id));
    await blobs.put(book.id, 'audio-short', new Blob(['one']));
    await blobs.put(book.id, 'audio-short', new Blob(['two-longer']));

    const stored = await blobs.get(book.id, 'audio-short');
    expect(await stored?.text()).toBe('two-longer');
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npm test -- src/lib/storage/repo.test.ts`
Expected: FAIL — `Failed to resolve import "./db"`.

- [ ] **Step 4: Write `src/lib/storage/db.ts`**

```ts
import { deleteDB, openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Book, Profile, ReviewCard, StoredBlob, Summary } from '../../types';

export const DB_NAME = 'booksum';
export const DB_VERSION = 1;

export interface BookSumDB extends DBSchema {
  profiles: { key: string; value: Profile };
  books: { key: string; value: Book; indexes: { 'by-profile': string } };
  summaries: { key: string; value: Summary; indexes: { 'by-book': string } };
  blobs: { key: string; value: StoredBlob; indexes: { 'by-book': string } };
  reviewCards: {
    key: string;
    value: ReviewCard;
    indexes: { 'by-profile-due': [string, string] };
  };
}

let dbPromise: Promise<IDBPDatabase<BookSumDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<BookSumDB>> {
  if (!dbPromise) {
    dbPromise = openDB<BookSumDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore('profiles', { keyPath: 'id' });

        const bookStore = db.createObjectStore('books', { keyPath: 'id' });
        bookStore.createIndex('by-profile', 'profileId');

        const summaryStore = db.createObjectStore('summaries', { keyPath: 'id' });
        summaryStore.createIndex('by-book', 'bookId');

        const blobStore = db.createObjectStore('blobs', { keyPath: 'key' });
        blobStore.createIndex('by-book', 'bookId');

        // Unused until Phase 3, created now so no version bump is needed later.
        const cardStore = db.createObjectStore('reviewCards', { keyPath: 'id' });
        cardStore.createIndex('by-profile-due', ['profileId', 'dueAt']);
      },
    });
  }
  return dbPromise;
}

/** Test-only: close and drop the database so each test starts clean. */
export async function resetDb(): Promise<void> {
  if (dbPromise) {
    (await dbPromise).close();
    dbPromise = null;
  }
  await deleteDB(DB_NAME);
}
```

- [ ] **Step 5: Write `src/lib/storage/repo.ts`**

```ts
import { getDb } from './db';
import type { BlobKind, Book, Profile, Summary } from '../../types';

const newId = () => crypto.randomUUID();

export const profiles = {
  async list(): Promise<Profile[]> {
    const all = await (await getDb()).getAll('profiles');
    return all.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },

  async get(id: string): Promise<Profile | undefined> {
    return (await getDb()).get('profiles', id);
  },

  async create(input: { name: string } & Partial<Omit<Profile, 'id' | 'name'>>): Promise<Profile> {
    const profile: Profile = {
      id: newId(),
      name: input.name.trim(),
      bio: input.bio ?? 'Passionate about distilling wisdom and applying it to daily life.',
      monthlyGoal: input.monthlyGoal ?? 4,
      favoriteVoice: input.favoriteVoice ?? 'Kore',
      theme: input.theme ?? 'system',
      createdAt: input.createdAt ?? new Date().toISOString(),
    };
    await (await getDb()).put('profiles', profile);
    return profile;
  },

  async update(profile: Profile): Promise<Profile> {
    await (await getDb()).put('profiles', profile);
    return profile;
  },

  async remove(id: string): Promise<void> {
    const owned = await books.listByProfile(id);
    await Promise.all(owned.map((book) => books.remove(book.id)));
    await (await getDb()).delete('profiles', id);
  },
};

export const books = {
  async listByProfile(profileId: string): Promise<Book[]> {
    return (await getDb()).getAllFromIndex('books', 'by-profile', profileId);
  },

  async get(id: string): Promise<Book | undefined> {
    return (await getDb()).get('books', id);
  },

  async create(
    input: Omit<Book, 'id' | 'addedAt'> & Partial<Pick<Book, 'id' | 'addedAt'>>,
  ): Promise<Book> {
    const book: Book = {
      ...input,
      id: input.id ?? newId(),
      addedAt: input.addedAt ?? new Date().toISOString(),
    };
    await (await getDb()).put('books', book);
    return book;
  },

  async update(book: Book): Promise<Book> {
    await (await getDb()).put('books', book);
    return book;
  },

  async remove(id: string): Promise<void> {
    const summary = await summaries.getByBook(id);
    if (summary) await summaries.remove(summary.id);
    await blobs.removeByBook(id);
    await (await getDb()).delete('books', id);
  },
};

export const summaries = {
  async getByBook(bookId: string): Promise<Summary | undefined> {
    return (await getDb()).getFromIndex('summaries', 'by-book', bookId);
  },

  async upsert(summary: Summary): Promise<Summary> {
    await (await getDb()).put('summaries', summary);
    return summary;
  },

  async remove(id: string): Promise<void> {
    await (await getDb()).delete('summaries', id);
  },
};

const blobKey = (bookId: string, kind: BlobKind) => `${bookId}:${kind}`;

export const blobs = {
  async put(bookId: string, kind: BlobKind, blob: Blob): Promise<void> {
    await (await getDb()).put('blobs', { key: blobKey(bookId, kind), bookId, kind, blob });
  },

  async get(bookId: string, kind: BlobKind): Promise<Blob | undefined> {
    const record = await (await getDb()).get('blobs', blobKey(bookId, kind));
    return record?.blob;
  },

  async removeByBook(bookId: string): Promise<void> {
    const db = await getDb();
    const keys = await db.getAllKeysFromIndex('blobs', 'by-book', bookId);
    await Promise.all(keys.map((key) => db.delete('blobs', key)));
  },
};
```

- [ ] **Step 6: Run the tests**

Run: `npm test -- src/lib/storage/repo.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 7: Write `src/lib/base64.ts`**

Needed by the migration in Task 3 and the AI layer in Task 6.

```ts
export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i] as number);
  }
  return btoa(binary);
}
```

- [ ] **Step 8: Write the base64 round-trip test**

Create `src/lib/base64.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { base64ToBytes, bytesToBase64 } from './base64';

describe('base64', () => {
  it('round-trips arbitrary bytes', () => {
    const bytes = new Uint8Array([0, 1, 127, 128, 255, 42]);
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
  });

  it('decodes a known value', () => {
    expect(new TextDecoder().decode(base64ToBytes('Qm9va1N1bQ=='))).toBe('BookSum');
  });
});
```

- [ ] **Step 9: Run the full suite**

Run: `npm test && npm run typecheck`
Expected: PASS. `src/types.ts` no longer exports `BookInsight`, `User`, `UserProfile`, or `ViewState`, so `tsc` will now report errors in `App.tsx`, `components/*`, `contexts/AuthContext.tsx`, and `services/geminiService.ts`.

To keep this task's commit green without dragging the whole UI migration into it, add a temporary compatibility module `src/legacy-types.ts` holding the old shapes verbatim, and repoint the existing UI files at it:

```ts
// Temporary. Deleted in Task 5 once the UI reads Book/Summary from the repo.
import type { BookStatus, Priority, VoiceName } from './types';

export type { BookStatus, Priority };

export interface User {
  id: string;
  name: string;
  email: string;
  photoUrl?: string;
}

export interface UserProfile {
  name: string;
  monthlyGoal: number;
  joinedAt: string;
  bio: string;
  favoriteVoice: VoiceName;
}

export interface BookInsight {
  id: string;
  title: string;
  author: string;
  category: string;
  oneSentenceTakeaway: string;
  summary: string;
  keyInsights: string[];
  actionableSteps: string[];
  detailedSummary?: string;
  personalNotes?: string;
  coverImageUrl: string;
  rating: number;
  priority?: Priority;
  readingTimeMinutes: number;
  addedAt: string;
  status: BookStatus;
  audioData?: string;
  pdfData?: string;
}

export type ViewState =
  'library' | 'book-detail' | 'adding-book' | 'e-reader' | 'stats' | 'profile';
```

Then in `src/App.tsx`, `src/components/*.tsx`, `src/contexts/AuthContext.tsx` and `src/services/geminiService.ts`, change imports of `BookInsight`, `User`, `UserProfile`, `ViewState` and `QuizQuestion` to come from the legacy module — for example `import type { BookInsight, ViewState } from './legacy-types';`. Leave `Category` and `QuizQuestion` importing from `./types`, which still exports both.

- [ ] **Step 10: Re-run the gate and commit**

```bash
npm run typecheck && npm test
git add -A
git commit -m "feat(storage): add IndexedDB schema and typed repository

Five object stores (profiles, books, summaries, blobs, reviewCards).
Binary data is stored as real Blobs keyed by bookId:kind, never base64
inside a record. Deletes cascade from profile to book to summary and blobs.

Splits BookInsight into Book + Summary so a book can exist unsummarised."
```

---

## Task 3: Legacy migration

**Files:**

- Create: `src/lib/storage/migrate.ts`, `src/lib/storage/migrate.test.ts`
- Depends on: Task 2

**Interfaces:**

- Consumes: `profiles`, `books`, `summaries`, `blobs` from `repo.ts`; `base64ToBytes` from `lib/base64.ts`
- Produces: `migrateLegacyData(): Promise<MigrationResult>` and `MIGRATION_MARKER` from `migrate.ts`, where `MigrationResult = { migrated: boolean; profiles: number; books: number; summaries: number; blobs: number }`

- [ ] **Step 1: Write the failing migration test**

Create `src/lib/storage/migrate.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from './db';
import { migrateLegacyData, MIGRATION_MARKER } from './migrate';
import { blobs, books, profiles, summaries } from './repo';

const LEGACY_USER_ID = 'user_abc123';

function seedLegacyLocalStorage() {
  localStorage.setItem(
    'booksum_db_users',
    JSON.stringify([
      { id: LEGACY_USER_ID, name: 'Dorian', email: 'd@example.test', password: 'hunter2' },
    ]),
  );
  localStorage.setItem(
    `booksum_profile_${LEGACY_USER_ID}`,
    JSON.stringify({
      name: 'Dorian',
      monthlyGoal: 8,
      joinedAt: '2026-01-01T00:00:00.000Z',
      bio: 'Reader',
      favoriteVoice: 'Puck',
    }),
  );
  localStorage.setItem(
    `booksum_library_${LEGACY_USER_ID}`,
    JSON.stringify([
      {
        id: 'book-1',
        title: 'Atomic Habits',
        author: 'James Clear',
        category: 'Productivity',
        oneSentenceTakeaway: 'Small changes compound.',
        summary: 'A summary.',
        keyInsights: ['One', 'Two'],
        actionableSteps: ['Do a thing'],
        coverImageUrl: 'https://example.test/cover.jpg',
        rating: 5,
        readingTimeMinutes: 12,
        addedAt: '2026-02-01T00:00:00.000Z',
        status: 'Finished',
        pdfData: btoa('fake pdf bytes'),
      },
      {
        id: 'book-2',
        title: 'Deep Work',
        author: 'Cal Newport',
        category: 'Productivity',
        oneSentenceTakeaway: 'Focus is a skill.',
        summary: 'Another summary.',
        keyInsights: [],
        actionableSteps: [],
        coverImageUrl: 'https://example.test/dw.jpg',
        rating: 4,
        readingTimeMinutes: 9,
        addedAt: '2026-03-01T00:00:00.000Z',
        status: 'Want to Read',
        priority: 'High',
      },
    ]),
  );
}

beforeEach(async () => {
  await resetDb();
  localStorage.clear();
});

describe('migrateLegacyData', () => {
  it('reports nothing to do when there is no legacy data', async () => {
    const result = await migrateLegacyData();
    expect(result).toEqual({ migrated: false, profiles: 0, books: 0, summaries: 0, blobs: 0 });
  });

  it('creates one profile per legacy library key', async () => {
    seedLegacyLocalStorage();
    const result = await migrateLegacyData();

    expect(result.migrated).toBe(true);
    expect(result.profiles).toBe(1);

    const [profile] = await profiles.list();
    expect(profile?.name).toBe('Dorian');
    expect(profile?.monthlyGoal).toBe(8);
    expect(profile?.favoriteVoice).toBe('Puck');
  });

  it('splits each legacy book into a Book and a Summary', async () => {
    seedLegacyLocalStorage();
    await migrateLegacyData();

    const [profile] = await profiles.list();
    const migrated = await books.listByProfile(profile!.id);
    expect(migrated).toHaveLength(2);

    const atomic = migrated.find((b) => b.title === 'Atomic Habits');
    expect(atomic?.status).toBe('Finished');
    expect(atomic?.hasPdf).toBe(true);
    expect(atomic?.summaryId).toBeTruthy();
    expect('pdfData' in (atomic as object)).toBe(false);

    const summary = await summaries.getByBook(atomic!.id);
    expect(summary?.keyInsights).toEqual(['One', 'Two']);
    expect(summary?.model).toBe('legacy');
  });

  it('moves base64 PDF data into the blob store', async () => {
    seedLegacyLocalStorage();
    await migrateLegacyData();

    const [profile] = await profiles.list();
    const migrated = await books.listByProfile(profile!.id);
    const atomic = migrated.find((b) => b.title === 'Atomic Habits');

    const pdf = await blobs.get(atomic!.id, 'pdf');
    expect(await pdf?.text()).toBe('fake pdf bytes');
  });

  it('never copies the legacy password into the database', async () => {
    seedLegacyLocalStorage();
    await migrateLegacyData();

    const dump = JSON.stringify(await profiles.list());
    expect(dump).not.toContain('hunter2');
    expect(dump).not.toContain('password');
  });

  it('leaves the legacy localStorage keys in place', async () => {
    seedLegacyLocalStorage();
    await migrateLegacyData();

    expect(localStorage.getItem(`booksum_library_${LEGACY_USER_ID}`)).not.toBeNull();
    expect(localStorage.getItem(MIGRATION_MARKER)).not.toBeNull();
  });

  it('is idempotent', async () => {
    seedLegacyLocalStorage();
    await migrateLegacyData();
    const second = await migrateLegacyData();

    expect(second.migrated).toBe(false);
    await expect(profiles.list()).resolves.toHaveLength(1);
  });

  it('falls back to a default name when no legacy profile record exists', async () => {
    localStorage.setItem(`booksum_library_orphan`, JSON.stringify([]));
    await migrateLegacyData();

    const [profile] = await profiles.list();
    expect(profile?.name).toBe('Reader');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- src/lib/storage/migrate.test.ts`
Expected: FAIL — `Failed to resolve import "./migrate"`.

- [ ] **Step 3: Write `src/lib/storage/migrate.ts`**

```ts
import { base64ToBytes } from '../base64';
import { blobs, books, profiles, summaries } from './repo';
import type { BookStatus, Priority, VoiceName } from '../../types';

export const MIGRATION_MARKER = 'booksum.migratedAt';

const LIBRARY_KEY_PREFIX = 'booksum_library_';

export interface MigrationResult {
  migrated: boolean;
  profiles: number;
  books: number;
  summaries: number;
  blobs: number;
}

interface LegacyBook {
  id?: string;
  title?: string;
  author?: string;
  category?: string;
  oneSentenceTakeaway?: string;
  summary?: string;
  keyInsights?: string[];
  actionableSteps?: string[];
  detailedSummary?: string;
  personalNotes?: string;
  coverImageUrl?: string;
  rating?: number;
  priority?: Priority;
  readingTimeMinutes?: number;
  addedAt?: string;
  status?: BookStatus;
  audioData?: string;
  pdfData?: string;
}

interface LegacyProfile {
  name?: string;
  monthlyGoal?: number;
  joinedAt?: string;
  bio?: string;
  favoriteVoice?: VoiceName;
}

const EMPTY: MigrationResult = {
  migrated: false,
  profiles: 0,
  books: 0,
  summaries: 0,
  blobs: 0,
};

function readJson<T>(key: string): T | null {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function legacyUserIds(): string[] {
  const ids: string[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key?.startsWith(LIBRARY_KEY_PREFIX)) {
      ids.push(key.slice(LIBRARY_KEY_PREFIX.length));
    }
  }
  return ids;
}

/**
 * One-time, non-destructive import of pre-IndexedDB data.
 * Legacy localStorage keys are left untouched; a marker prevents re-running.
 * Passwords in `booksum_db_users` are never read.
 */
export async function migrateLegacyData(): Promise<MigrationResult> {
  if (localStorage.getItem(MIGRATION_MARKER)) return EMPTY;

  const userIds = legacyUserIds();
  if (userIds.length === 0) return EMPTY;

  const result: MigrationResult = { ...EMPTY, migrated: true };

  for (const userId of userIds) {
    const legacyProfile = readJson<LegacyProfile>(`booksum_profile_${userId}`);
    const profile = await profiles.create({
      name: legacyProfile?.name?.trim() || 'Reader',
      bio: legacyProfile?.bio,
      monthlyGoal: legacyProfile?.monthlyGoal,
      favoriteVoice: legacyProfile?.favoriteVoice,
      createdAt: legacyProfile?.joinedAt,
    });
    result.profiles += 1;

    const legacyBooks = readJson<LegacyBook[]>(`${LIBRARY_KEY_PREFIX}${userId}`) ?? [];

    for (const legacy of legacyBooks) {
      const summaryId = crypto.randomUUID();
      const addedAt = legacy.addedAt ?? new Date().toISOString();

      const book = await books.create({
        profileId: profile.id,
        title: legacy.title ?? 'Untitled',
        author: legacy.author ?? 'Unknown',
        category: legacy.category ?? 'Other',
        status: legacy.status ?? 'Want to Read',
        priority: legacy.priority,
        rating: legacy.rating ?? 0,
        personalNotes: legacy.personalNotes,
        coverImageUrl: legacy.coverImageUrl ?? '',
        readingTimeMinutes: legacy.readingTimeMinutes ?? 5,
        addedAt,
        summaryId,
        hasPdf: Boolean(legacy.pdfData),
      });
      result.books += 1;

      await summaries.upsert({
        id: summaryId,
        bookId: book.id,
        oneSentenceTakeaway: legacy.oneSentenceTakeaway ?? '',
        summary: legacy.summary ?? '',
        keyInsights: legacy.keyInsights ?? [],
        actionableSteps: legacy.actionableSteps ?? [],
        detailedSummary: legacy.detailedSummary,
        generatedAt: addedAt,
        model: 'legacy',
      });
      result.summaries += 1;

      if (legacy.pdfData) {
        const bytes = base64ToBytes(legacy.pdfData);
        await blobs.put(book.id, 'pdf', new Blob([bytes], { type: 'application/pdf' }));
        result.blobs += 1;
      }

      if (legacy.audioData) {
        const bytes = base64ToBytes(legacy.audioData);
        await blobs.put(book.id, 'audio-short', new Blob([bytes], { type: 'audio/wav' }));
        result.blobs += 1;
      }
    }
  }

  localStorage.setItem(MIGRATION_MARKER, new Date().toISOString());
  return result;
}
```

- [ ] **Step 4: Run the tests**

Run: `npm test -- src/lib/storage/migrate.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
npm run typecheck && npm test
git add -A
git commit -m "feat(storage): migrate legacy localStorage data into IndexedDB

Non-destructive and idempotent. Splits each legacy BookInsight into a Book
plus a Summary, decodes base64 PDF and audio into the blob store, and never
reads the plaintext passwords from booksum_db_users."
```

---

## Task 4: Local profiles replace the fake auth

**Files:**

- Create: `src/features/profile/ProfileContext.tsx`, `src/features/profile/ProfilePicker.tsx`, `src/features/profile/ProfileContext.test.tsx`
- Modify: `src/main.tsx`, `src/App.tsx`
- Delete: `src/contexts/AuthContext.tsx`, `src/components/LoginView.tsx`
- Depends on: Tasks 2, 3

**Interfaces:**

- Consumes: `profiles` from `repo.ts`, `migrateLegacyData` from `migrate.ts`
- Produces: `ProfileProvider`, `useProfile()` returning `{ profile: Profile | null, allProfiles: Profile[], isLoading: boolean, selectProfile(id): Promise<void>, createProfile(name): Promise<Profile>, updateProfile(p): Promise<void>, deleteProfile(id): Promise<void>, signOut(): void }`, and `ACTIVE_PROFILE_KEY = 'booksum.activeProfile'`

- [ ] **Step 1: Write the failing context test**

Create `src/features/profile/ProfileContext.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '../../lib/storage/db';
import { books, profiles } from '../../lib/storage/repo';
import { ACTIVE_PROFILE_KEY, ProfileProvider, useProfile } from './ProfileContext';

function Probe() {
  const { profile, allProfiles, isLoading, createProfile, selectProfile, signOut } = useProfile();
  if (isLoading) return <p>loading</p>;
  return (
    <div>
      <p data-testid="active">{profile?.name ?? 'none'}</p>
      <p data-testid="count">{allProfiles.length}</p>
      <button onClick={() => void createProfile('Dorian')}>create</button>
      <button onClick={() => void selectProfile(allProfiles[0]!.id)}>select first</button>
      <button onClick={signOut}>sign out</button>
    </div>
  );
}

function renderProbe() {
  return render(
    <ProfileProvider>
      <Probe />
    </ProfileProvider>,
  );
}

beforeEach(async () => {
  await resetDb();
  localStorage.clear();
});

describe('ProfileContext', () => {
  it('starts with no active profile', async () => {
    renderProbe();
    await waitFor(() => expect(screen.getByTestId('active')).toHaveTextContent('none'));
  });

  it('selects a newly created profile and persists the selection', async () => {
    renderProbe();
    await waitFor(() => expect(screen.getByTestId('active')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'create' }));

    await waitFor(() => expect(screen.getByTestId('active')).toHaveTextContent('Dorian'));
    expect(screen.getByTestId('count')).toHaveTextContent('1');
    expect(localStorage.getItem(ACTIVE_PROFILE_KEY)).toBeTruthy();
  });

  it('restores the persisted profile on mount', async () => {
    const created = await profiles.create({ name: 'Restored' });
    localStorage.setItem(ACTIVE_PROFILE_KEY, created.id);

    renderProbe();
    await waitFor(() => expect(screen.getByTestId('active')).toHaveTextContent('Restored'));
  });

  it('clears the selection on sign out without deleting the profile', async () => {
    const created = await profiles.create({ name: 'Dorian' });
    localStorage.setItem(ACTIVE_PROFILE_KEY, created.id);

    renderProbe();
    await waitFor(() => expect(screen.getByTestId('active')).toHaveTextContent('Dorian'));

    await userEvent.click(screen.getByRole('button', { name: 'sign out' }));

    await waitFor(() => expect(screen.getByTestId('active')).toHaveTextContent('none'));
    expect(localStorage.getItem(ACTIVE_PROFILE_KEY)).toBeNull();
    await expect(profiles.list()).resolves.toHaveLength(1);
  });

  it('ignores a stale persisted id', async () => {
    localStorage.setItem(ACTIVE_PROFILE_KEY, 'does-not-exist');
    renderProbe();
    await waitFor(() => expect(screen.getByTestId('active')).toHaveTextContent('none'));
  });

  it('keeps each profile library separate', async () => {
    const a = await profiles.create({ name: 'A' });
    const b = await profiles.create({ name: 'B' });
    await books.create({
      profileId: a.id,
      title: 'Only A',
      author: 'x',
      category: 'Other',
      status: 'Finished',
      rating: 0,
      readingTimeMinutes: 0,
      coverImageUrl: '',
      hasPdf: false,
    });

    await expect(books.listByProfile(a.id)).resolves.toHaveLength(1);
    await expect(books.listByProfile(b.id)).resolves.toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- src/features/profile/ProfileContext.test.tsx`
Expected: FAIL — `Failed to resolve import "./ProfileContext"`.

- [ ] **Step 3: Write `src/features/profile/ProfileContext.tsx`**

```tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { migrateLegacyData } from '../../lib/storage/migrate';
import { profiles as profileRepo } from '../../lib/storage/repo';
import type { Profile } from '../../types';

export const ACTIVE_PROFILE_KEY = 'booksum.activeProfile';

interface ProfileContextValue {
  profile: Profile | null;
  allProfiles: Profile[];
  isLoading: boolean;
  selectProfile: (id: string) => Promise<void>;
  createProfile: (name: string) => Promise<Profile>;
  updateProfile: (profile: Profile) => Promise<void>;
  deleteProfile: (id: string) => Promise<void>;
  signOut: () => void;
}

const ProfileContext = createContext<ProfileContextValue | undefined>(undefined);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      await migrateLegacyData();
      const list = await profileRepo.list();
      if (cancelled) return;

      setAllProfiles(list);

      const storedId = localStorage.getItem(ACTIVE_PROFILE_KEY);
      const restored = storedId ? (list.find((p) => p.id === storedId) ?? null) : null;
      if (!restored && storedId) localStorage.removeItem(ACTIVE_PROFILE_KEY);
      setProfile(restored);
      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const selectProfile = useCallback(async (id: string) => {
    const found = await profileRepo.get(id);
    if (!found) return;
    localStorage.setItem(ACTIVE_PROFILE_KEY, found.id);
    setProfile(found);
  }, []);

  const createProfile = useCallback(async (name: string) => {
    const created = await profileRepo.create({ name });
    setAllProfiles(await profileRepo.list());
    localStorage.setItem(ACTIVE_PROFILE_KEY, created.id);
    setProfile(created);
    return created;
  }, []);

  const updateProfile = useCallback(async (next: Profile) => {
    await profileRepo.update(next);
    setAllProfiles(await profileRepo.list());
    setProfile((current) => (current?.id === next.id ? next : current));
  }, []);

  const deleteProfile = useCallback(async (id: string) => {
    await profileRepo.remove(id);
    setAllProfiles(await profileRepo.list());
    setProfile((current) => {
      if (current?.id !== id) return current;
      localStorage.removeItem(ACTIVE_PROFILE_KEY);
      return null;
    });
  }, []);

  const signOut = useCallback(() => {
    localStorage.removeItem(ACTIVE_PROFILE_KEY);
    setProfile(null);
  }, []);

  const value = useMemo(
    () => ({
      profile,
      allProfiles,
      isLoading,
      selectProfile,
      createProfile,
      updateProfile,
      deleteProfile,
      signOut,
    }),
    [
      profile,
      allProfiles,
      isLoading,
      selectProfile,
      createProfile,
      updateProfile,
      deleteProfile,
      signOut,
    ],
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile(): ProfileContextValue {
  const context = useContext(ProfileContext);
  if (!context) throw new Error('useProfile must be used within a ProfileProvider');
  return context;
}
```

- [ ] **Step 4: Run the tests**

Run: `npm test -- src/features/profile/ProfileContext.test.tsx`
Expected: PASS, 6 tests.

- [ ] **Step 5: Write `src/features/profile/ProfilePicker.tsx`**

Reuses the visual language of the deleted `LoginView` — same orange serif mark, same card treatment — with the password fields gone.

```tsx
import { useState } from 'react';
import { BookOpen, Loader2, Plus, Trash2 } from 'lucide-react';
import { useProfile } from './ProfileContext';

export function ProfilePicker() {
  const { allProfiles, selectProfile, createProfile, deleteProfile } = useProfile();
  const [name, setName] = useState('');
  const [isCreating, setIsCreating] = useState(allProfiles.length === 0);
  const [isBusy, setIsBusy] = useState(false);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || isBusy) return;
    setIsBusy(true);
    try {
      await createProfile(name);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-parchment flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 justify-center mb-10">
          <div className="w-12 h-12 bg-orange-600 rounded-xl flex items-center justify-center text-white font-serif font-bold italic text-2xl shadow-lg shadow-orange-100">
            B
          </div>
          <h1 className="text-3xl font-serif font-bold text-orange-700 italic tracking-tighter">
            BookSum
          </h1>
        </div>

        <h2 className="text-2xl font-serif font-bold text-gray-900 text-center mb-2">
          Who&rsquo;s reading?
        </h2>
        <p className="text-sm text-gray-500 text-center mb-8">
          Profiles keep libraries separate on this device. No passwords, no accounts — everything
          stays in this browser.
        </p>

        {!isCreating && (
          <ul className="space-y-3 mb-6">
            {allProfiles.map((candidate) => (
              <li key={candidate.id} className="flex items-center gap-2">
                <button
                  onClick={() => void selectProfile(candidate.id)}
                  className="flex-1 flex items-center gap-4 p-4 bg-white border border-gray-100 rounded-2xl shadow-sm hover:border-orange-200 hover:shadow-md transition-all text-left"
                >
                  <span className="w-10 h-10 rounded-full bg-orange-100 text-orange-700 font-bold flex items-center justify-center">
                    {candidate.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="font-semibold text-gray-900">{candidate.name}</span>
                  <BookOpen size={18} className="ml-auto text-gray-300" />
                </button>
                <button
                  onClick={() => void deleteProfile(candidate.id)}
                  aria-label={`Delete profile ${candidate.name}`}
                  className="p-3 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                >
                  <Trash2 size={18} />
                </button>
              </li>
            ))}
          </ul>
        )}

        {isCreating ? (
          <form onSubmit={handleCreate} className="space-y-4">
            <label className="block">
              <span className="block text-sm font-semibold text-gray-700 mb-2">Your name</span>
              <input
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Dorian"
                className="w-full px-4 py-4 bg-white border border-gray-100 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none transition-all text-gray-900"
              />
            </label>
            <button
              type="submit"
              disabled={!name.trim() || isBusy}
              className="w-full py-4 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white rounded-2xl font-bold shadow-lg shadow-orange-200 transition-all flex items-center justify-center gap-2"
            >
              {isBusy ? <Loader2 size={20} className="animate-spin" /> : null}
              Start reading
            </button>
            {allProfiles.length > 0 && (
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="w-full text-sm text-gray-500 hover:text-gray-900 transition-colors"
              >
                Back to profiles
              </button>
            )}
          </form>
        ) : (
          <button
            onClick={() => setIsCreating(true)}
            className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-gray-200 rounded-2xl text-gray-500 hover:border-orange-400 hover:text-orange-600 transition-all font-semibold"
          >
            <Plus size={18} /> Add a profile
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Wire the provider into `src/main.tsx`**

```tsx
import './index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ProfileProvider } from './features/profile/ProfileContext';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Could not find root element to mount to');

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ProfileProvider>
      <App />
    </ProfileProvider>
  </React.StrictMode>,
);
```

- [ ] **Step 7: Swap auth for profiles in `src/App.tsx`**

Replace the `useAuth` import and destructure:

```tsx
import { useProfile } from './features/profile/ProfileContext';
import { ProfilePicker } from './features/profile/ProfilePicker';
```

```tsx
const { profile, isLoading: profileLoading, signOut } = useProfile();
```

Then:

- `if (authLoading)` becomes `if (profileLoading)`.
- `if (!user) return <LoginView />;` becomes `if (!profile) return <ProfilePicker />;`.
- Every `user.id` becomes `profile.id`, `user.name` becomes `profile.name`, and `logout` becomes `signOut`.
- The sidebar card at `App.tsx:381-391` shows `user.email` and `user.photoUrl`, neither of which exists now. Replace the `<img>` with the same initial-circle used in `ProfilePicker`, and replace the email line with the profile bio truncated to one line.
- Delete the `DEFAULT_PROFILE` constant and the `userProfile` / `setUserProfile` state; `ProfileView` now receives `profile` from `useProfile()` and calls `updateProfile`. Update `ProfileView`'s props accordingly (`profile: Profile`, `onUpdate: (p: Profile) => void`) and change its `joinedAt` references to `createdAt`.

- [ ] **Step 8: Delete the auth files**

```bash
git rm src/contexts/AuthContext.tsx src/components/LoginView.tsx
rmdir src/contexts 2>/dev/null || true
```

- [ ] **Step 9: Run the gate**

```bash
npm run typecheck && npm test
```

Expected: PASS. If `tsc` reports `User` is still imported anywhere, remove it from `src/legacy-types.ts` and the importing file — nothing should reference it after this task.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(profile): replace fake password auth with local profiles

Deletes AuthContext and LoginView, which stored plaintext passwords in
localStorage under booksum_db_users. Profiles live in IndexedDB and the
active selection is a single id in localStorage. Libraries stay namespaced
by profileId, so migrated data maps across unchanged."
```

---

## Task 5: Library state reads and writes through the repo

**Files:**

- Create: `src/features/library/useLibrary.ts`, `src/features/library/useLibrary.test.tsx`
- Modify: `src/App.tsx`, `src/components/BookDetail.tsx`, `src/components/AddBookModal.tsx`, `src/components/EReader.tsx`, `src/components/BookCard.tsx`, `src/components/StatsView.tsx`, `src/components/ProfileView.tsx`
- Delete: `src/legacy-types.ts`
- Depends on: Tasks 2, 4

**Interfaces:**

- Consumes: `books`, `summaries`, `blobs` from `repo.ts`; `useProfile` from `ProfileContext`
- Produces: `useLibrary()` returning `{ books: Book[], isLoading: boolean, addBook(input, options?): Promise<Book>, updateBook(book): Promise<void>, removeBook(id): Promise<void>, getSummary(bookId): Promise<Summary | undefined>, saveSummary(summary): Promise<void>, reload(): Promise<void> }` where `options` is `{ summary?: Omit<Summary,'id'|'bookId'>, pdf?: Blob }`

- [ ] **Step 1: Write the failing library hook test**

Create `src/features/library/useLibrary.test.tsx`:

```tsx
import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '../../lib/storage/db';
import { blobs, books as bookRepo, profiles } from '../../lib/storage/repo';
import { ACTIVE_PROFILE_KEY, ProfileProvider } from '../profile/ProfileContext';
import { useLibrary } from './useLibrary';
import type { Book } from '../../types';

let api: ReturnType<typeof useLibrary>;

function Probe() {
  api = useLibrary();
  return <p data-testid="count">{api.isLoading ? 'loading' : String(api.books.length)}</p>;
}

async function renderLibrary() {
  const profile = await profiles.create({ name: 'Dorian' });
  localStorage.setItem(ACTIVE_PROFILE_KEY, profile.id);
  render(
    <ProfileProvider>
      <Probe />
    </ProfileProvider>,
  );
  await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('0'));
  return profile;
}

const draft = (title = 'Atomic Habits') => ({
  title,
  author: 'James Clear',
  category: 'Productivity',
  status: 'Finished' as const,
  rating: 5,
  readingTimeMinutes: 12,
  coverImageUrl: 'https://example.test/c.jpg',
  hasPdf: false,
});

beforeEach(async () => {
  await resetDb();
  localStorage.clear();
});

describe('useLibrary', () => {
  it('adds a book and exposes it', async () => {
    await renderLibrary();
    await act(async () => {
      await api.addBook(draft());
    });
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('1'));
  });

  it('persists across a remount', async () => {
    const profile = await renderLibrary();
    await act(async () => {
      await api.addBook(draft());
    });
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('1'));

    await expect(bookRepo.listByProfile(profile.id)).resolves.toHaveLength(1);
  });

  it('stores an attached PDF as a blob and keeps the record small', async () => {
    await renderLibrary();
    const bytes = new Uint8Array(10 * 1024 * 1024);
    let created!: Book;

    await act(async () => {
      created = await api.addBook(
        { ...draft('Big PDF'), hasPdf: true },
        { pdf: new Blob([bytes], { type: 'application/pdf' }) },
      );
    });

    const stored = await blobs.get(created.id, 'pdf');
    expect(stored?.size).toBe(bytes.byteLength);

    const record = await bookRepo.get(created.id);
    expect(JSON.stringify(record).length).toBeLessThan(1_000);
  });

  it('writes an attached summary and reads it back', async () => {
    await renderLibrary();
    let created!: Book;
    await act(async () => {
      created = await api.addBook(draft(), {
        summary: {
          oneSentenceTakeaway: 'Small changes compound.',
          summary: 'Body',
          keyInsights: ['One'],
          actionableSteps: ['Do'],
          generatedAt: new Date().toISOString(),
          model: 'test-model',
        },
      });
    });

    const summary = await api.getSummary(created.id);
    expect(summary?.oneSentenceTakeaway).toBe('Small changes compound.');
    expect((await bookRepo.get(created.id))?.summaryId).toBe(summary?.id);
  });

  it('removes a book and its blobs', async () => {
    await renderLibrary();
    let created!: Book;
    await act(async () => {
      created = await api.addBook({ ...draft(), hasPdf: true }, { pdf: new Blob(['x']) });
    });

    await act(async () => {
      await api.removeBook(created.id);
    });

    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('0'));
    await expect(blobs.get(created.id, 'pdf')).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- src/features/library/useLibrary.test.tsx`
Expected: FAIL — `Failed to resolve import "./useLibrary"`.

- [ ] **Step 3: Write `src/features/library/useLibrary.ts`**

```ts
import { useCallback, useEffect, useState } from 'react';
import { blobs, books as bookRepo, summaries as summaryRepo } from '../../lib/storage/repo';
import { useProfile } from '../profile/ProfileContext';
import type { Book, Summary } from '../../types';

export type BookDraft = Omit<Book, 'id' | 'profileId' | 'addedAt' | 'summaryId'>;

export interface AddBookOptions {
  summary?: Omit<Summary, 'id' | 'bookId'>;
  pdf?: Blob;
}

export function useLibrary() {
  const { profile } = useProfile();
  const [books, setBooks] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!profile) {
      setBooks([]);
      setIsLoading(false);
      return;
    }
    setBooks(await bookRepo.listByProfile(profile.id));
    setIsLoading(false);
  }, [profile]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const addBook = useCallback(
    async (draft: BookDraft, options: AddBookOptions = {}): Promise<Book> => {
      if (!profile) throw new Error('No active profile');

      const summaryId = options.summary ? crypto.randomUUID() : undefined;
      const book = await bookRepo.create({ ...draft, profileId: profile.id, summaryId });

      if (options.summary && summaryId) {
        await summaryRepo.upsert({ ...options.summary, id: summaryId, bookId: book.id });
      }
      if (options.pdf) {
        await blobs.put(book.id, 'pdf', options.pdf);
      }

      await reload();
      return book;
    },
    [profile, reload],
  );

  const updateBook = useCallback(
    async (book: Book) => {
      await bookRepo.update(book);
      await reload();
    },
    [reload],
  );

  const removeBook = useCallback(
    async (id: string) => {
      await bookRepo.remove(id);
      await reload();
    },
    [reload],
  );

  const getSummary = useCallback((bookId: string) => summaryRepo.getByBook(bookId), []);

  const saveSummary = useCallback(
    async (summary: Summary) => {
      await summaryRepo.upsert(summary);
      const book = await bookRepo.get(summary.bookId);
      if (book && book.summaryId !== summary.id) {
        await bookRepo.update({ ...book, summaryId: summary.id });
        await reload();
      }
    },
    [reload],
  );

  return { books, isLoading, addBook, updateBook, removeBook, getSummary, saveSummary, reload };
}
```

- [ ] **Step 4: Run the tests**

Run: `npm test -- src/features/library/useLibrary.test.tsx`
Expected: PASS, 5 tests.

- [ ] **Step 5: Replace the localStorage effects in `src/App.tsx`**

Delete these blocks and replace with `useLibrary()`:

- `App.tsx:94-149` — the load-from-localStorage effect, including the hardcoded Atomic Habits seed book. Seeding is dropped; a new profile starts with an empty library and the existing empty state at `App.tsx:493-512` already handles it.
- `App.tsx:208-221` — both save effects.
- `handleAddBook`, `handleDeleteBook`, `handleUpdateBook`, `handleResetLibrary`, `handleImportLibrary` — reimplement on top of `addBook`, `removeBook`, `updateBook` and a new `resetLibrary` that maps `books` through `removeBook`.

```tsx
const { books, isLoading: libraryLoading, addBook, updateBook, removeBook } = useLibrary();
```

`handleResetLibrary` becomes:

```tsx
const handleResetLibrary = async () => {
  if (
    !confirm(
      'DANGER: This will permanently delete all books and insights in your library. Continue?',
    )
  )
    return;
  await Promise.all(books.map((book) => removeBook(book.id)));
  setRecommendations(RECOMMENDED_BOOKS);
  setView('library');
};
```

The `confirm()` stays for now — Phase 2 replaces it with `ConfirmDialog`.

- [ ] **Step 6: Move summary text out of the book props**

`BookDetail`, `EReader`, `ChatModal`, `QuizModal` and `DailyWisdomModal` currently read `book.summary`, `book.keyInsights`, `book.actionableSteps`, `book.oneSentenceTakeaway` and `book.detailedSummary`. Change each to accept a `summary: Summary | undefined` prop alongside `book: Book`, and have `App.tsx` load it once when a book is selected:

```tsx
const [selectedSummary, setSelectedSummary] = useState<Summary | undefined>(undefined);

const handleBookSelect = async (book: Book) => {
  setSelectedBook(book);
  setSelectedSummary(await getSummary(book.id));
  setView('book-detail');
};
```

Exact prop signatures after this step:

```ts
// src/components/BookDetail.tsx
interface BookDetailProps {
  book: Book;
  summary: Summary | undefined;
  onBack: () => void;
  onDelete: (id: string) => void;
  onUpdate: (book: Book) => void;
  onSummaryUpdate: (summary: Summary) => void; // replaces mutating book.detailedSummary
  onOpenReader: () => void;
  isPreview: boolean;
  onAdd: () => void;
  onPlayAudio: (track: AudioTrack) => void;
}

// src/components/EReader.tsx
interface EReaderProps {
  book: Book;
  summary: Summary | undefined;
  onClose: () => void;
  onPlayAudio: (track: AudioTrack) => void;
  hasAudioPlayer: boolean;
}

// src/components/ChatModal.tsx
interface ChatModalProps {
  book: Book;
  summary: Summary;
  onClose: () => void;
}

// src/components/QuizModal.tsx
interface QuizModalProps {
  book: Book;
  summary: Summary;
  onClose: () => void;
}

// src/components/DailyWisdomModal.tsx
interface DailyWisdomModalProps {
  book: Book;
  summary: Summary | undefined;
  onClose: () => void;
  onReadMore: () => void;
}
```

`ChatModal` and `QuizModal` take a non-optional `Summary` because neither can function without one — `BookDetail` disables both buttons until `summary` is defined, with the tooltip "Generate a summary first".

`BookCard` and `StatsView` keep taking only `Book`; both render `readingTimeMinutes`, which lives on `Book` for exactly this reason.

`AudioTrack` is the existing exported type from `src/components/AudioPlayer.tsx`; its `audioData: string` field becomes `audio: Blob` since `generateAudioSummary` now returns a `Blob`. Update `AudioPlayer` to build its object URL with `URL.createObjectURL(track.audio)` and revoke it on unmount.

- [ ] **Step 7: Delete the compatibility shim**

```bash
git rm src/legacy-types.ts
```

Fix any remaining imports `tsc` reports. `QuizQuestion` comes from `./types`; `Book`, `Summary`, `Profile` come from `./types`.

- [ ] **Step 8: Run the gate**

```bash
npm run typecheck && npm test && npm run build
```

Expected: all PASS.

- [ ] **Step 9: Manual verification**

```bash
npm run dev
```

Create a profile, add a book by title (it will prompt for a key — cancel), confirm the empty state renders, reload the page and confirm the profile is restored. Open DevTools → Application → IndexedDB → `booksum` and confirm the `books` store holds the record.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(library): back the library with IndexedDB instead of localStorage

Removes the whole-array localStorage writes and the base64 PDF/audio fields
that blew the origin quota. Book records now carry no binary data; summaries
load on demand. Drops the hardcoded Atomic Habits seed book."
```

---

## Task 6: AI module split, BYOK gating, and cost fixes

**Files:**

- Create: `src/lib/ai/models.ts`, `apiKey.ts`, `client.ts`, `errors.ts`, `schemas.ts`, `prompts.ts`, `summarize.ts`, `quiz.ts`, `chat.ts`, `tts.ts`, `recommend.ts`; `src/lib/covers/googleBooks.ts`, `openLibrary.ts`, `placeholder.ts`, `index.ts`; `src/lib/audio/wav.ts`; `src/features/settings/ApiKeyDialog.tsx`
- Create tests: `src/lib/ai/errors.test.ts`, `src/lib/ai/apiKey.test.ts`, `src/lib/covers/index.test.ts`, `src/lib/audio/wav.test.ts`
- Delete: `src/services/geminiService.ts`
- Modify: `src/App.tsx`, `src/components/AddBookModal.tsx`, `src/components/BookDetail.tsx`, `src/components/ChatModal.tsx`, `src/components/QuizModal.tsx`, `src/components/AudioPlayer.tsx`
- Depends on: Tasks 1–5

**Interfaces:**

- Consumes: `base64ToBytes` from `lib/base64.ts`, `Summary`/`Book`/`QuizQuestion`/`VoiceName` from `types.ts`
- Produces:
  - `MODELS` from `models.ts`
  - `getApiKey()`, `setApiKey(k)`, `clearApiKey()`, `hasApiKey()`, `subscribeToApiKey(fn)` from `apiKey.ts`
  - `getClient()`, `resetClientCache()` from `client.ts`
  - `AiError`, `AiErrorKind`, `MissingKeyError`, `toAiError(e)` from `errors.ts`
  - `fetchCover(title, author)` from `covers/index.ts`
  - `pcmToWavBlob(bytes)` from `audio/wav.ts`

- [ ] **Step 1: Write the failing error-mapping test**

Create `src/lib/ai/errors.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { AiError, MissingKeyError, toAiError } from './errors';

function apiError(status: number, message = 'boom') {
  return Object.assign(new Error(message), { name: 'ApiError', status });
}

describe('toAiError', () => {
  it('passes an AiError through untouched', () => {
    const original = new MissingKeyError();
    expect(toAiError(original)).toBe(original);
  });

  it.each([
    [400, 'invalid-key'],
    [401, 'invalid-key'],
    [403, 'invalid-key'],
    [429, 'rate-limited'],
    [500, 'unknown'],
    [503, 'unknown'],
  ])('maps HTTP %i to %s', (status, kind) => {
    expect(toAiError(apiError(status)).kind).toBe(kind);
  });

  it('detects a quota message ahead of the raw status', () => {
    expect(toAiError(apiError(429, 'Quota exceeded for this project')).kind).toBe('quota');
  });

  it('maps a safety block', () => {
    expect(toAiError(apiError(400, 'Response blocked due to SAFETY')).kind).toBe('safety');
  });

  it('maps a fetch failure to a network error', () => {
    expect(toAiError(new TypeError('Failed to fetch')).kind).toBe('network');
  });

  it('maps a JSON parse failure', () => {
    expect(toAiError(new SyntaxError('Unexpected token < in JSON')).kind).toBe('malformed');
  });

  it('always produces a user-facing message', () => {
    for (const status of [400, 401, 429, 500]) {
      const error = toAiError(apiError(status));
      expect(error).toBeInstanceOf(AiError);
      expect(error.message.length).toBeGreaterThan(10);
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- src/lib/ai/errors.test.ts`
Expected: FAIL — `Failed to resolve import "./errors"`.

- [ ] **Step 3: Write `src/lib/ai/errors.ts`**

```ts
export type AiErrorKind =
  | 'missing-key'
  | 'invalid-key'
  | 'rate-limited'
  | 'quota'
  | 'safety'
  | 'network'
  | 'malformed'
  | 'unknown';

export class AiError extends Error {
  constructor(
    readonly kind: AiErrorKind,
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'AiError';
  }
}

export class MissingKeyError extends AiError {
  constructor() {
    super('missing-key', 'Add your Gemini API key to use AI features.');
  }
}

const MESSAGES: Record<AiErrorKind, string> = {
  'missing-key': 'Add your Gemini API key to use AI features.',
  'invalid-key': 'That API key was rejected. Check it in Settings and try again.',
  'rate-limited': 'Google is rate-limiting your key. Wait a moment and try again.',
  quota: 'Your Gemini quota is used up. Check your usage in Google AI Studio.',
  safety: 'Gemini blocked this request under its safety filters. Try a different book or wording.',
  network: 'Could not reach Google. Check your connection and try again.',
  malformed: 'Gemini returned a response BookSum could not read. Try again.',
  unknown: 'Something went wrong talking to Gemini. Try again.',
};

function statusOf(error: unknown): number | undefined {
  const status = (error as { status?: unknown }).status;
  return typeof status === 'number' ? status : undefined;
}

/** Normalises anything thrown by the Gemini SDK or fetch into an AiError. */
export function toAiError(error: unknown): AiError {
  if (error instanceof AiError) return error;

  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  let kind: AiErrorKind = 'unknown';

  if (lower.includes('quota')) kind = 'quota';
  else if (lower.includes('safety') || lower.includes('blocked')) kind = 'safety';
  else if (error instanceof SyntaxError) kind = 'malformed';
  else if (error instanceof TypeError && lower.includes('fetch')) kind = 'network';
  else {
    const status = statusOf(error);
    if (status === 400 || status === 401 || status === 403) kind = 'invalid-key';
    else if (status === 429) kind = 'rate-limited';
  }

  return new AiError(kind, MESSAGES[kind], error);
}
```

- [ ] **Step 4: Run the error tests**

Run: `npm test -- src/lib/ai/errors.test.ts`
Expected: PASS, 12 assertions across 7 tests.

- [ ] **Step 5: Write the failing API-key test**

Create `src/lib/ai/apiKey.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  API_KEY_STORAGE_KEY,
  clearApiKey,
  getApiKey,
  hasApiKey,
  setApiKey,
  subscribeToApiKey,
} from './apiKey';

beforeEach(() => {
  localStorage.clear();
});

describe('apiKey', () => {
  it('reports no key by default', () => {
    expect(getApiKey()).toBeNull();
    expect(hasApiKey()).toBe(false);
  });

  it('stores and reads a trimmed key', () => {
    setApiKey('  AIzaTestKey  ');
    expect(getApiKey()).toBe('AIzaTestKey');
    expect(localStorage.getItem(API_KEY_STORAGE_KEY)).toBe('AIzaTestKey');
  });

  it('treats an empty string as no key', () => {
    setApiKey('   ');
    expect(getApiKey()).toBeNull();
  });

  it('clears the key', () => {
    setApiKey('AIzaTestKey');
    clearApiKey();
    expect(hasApiKey()).toBe(false);
  });

  it('notifies subscribers on set and clear', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToApiKey(listener);

    setApiKey('AIzaTestKey');
    clearApiKey();
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    setApiKey('AIzaAnother');
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 6: Write `src/lib/ai/apiKey.ts`**

```ts
export const API_KEY_STORAGE_KEY = 'booksum.apiKey';

const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

export function getApiKey(): string | null {
  const value = localStorage.getItem(API_KEY_STORAGE_KEY)?.trim();
  return value ? value : null;
}

export function hasApiKey(): boolean {
  return getApiKey() !== null;
}

export function setApiKey(key: string): void {
  const trimmed = key.trim();
  if (trimmed) localStorage.setItem(API_KEY_STORAGE_KEY, trimmed);
  else localStorage.removeItem(API_KEY_STORAGE_KEY);
  notify();
}

export function clearApiKey(): void {
  localStorage.removeItem(API_KEY_STORAGE_KEY);
  notify();
}

export function subscribeToApiKey(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
```

- [ ] **Step 7: Write `src/lib/ai/client.ts` and `src/lib/ai/models.ts`**

`models.ts`:

```ts
/** The only place model IDs appear. A Google rename is a one-line change here. */
export const MODELS = {
  summary: 'gemini-3-flash-preview',
  detailedSummary: 'gemini-3-pro-preview',
  quiz: 'gemini-3-flash-preview',
  chat: 'gemini-3-flash-preview',
  recommendations: 'gemini-3-flash-preview',
  tts: 'gemini-2.5-flash-preview-tts',
} as const;
```

`client.ts`:

```ts
import { GoogleGenAI } from '@google/genai';
import { getApiKey } from './apiKey';
import { MissingKeyError } from './errors';

let cached: { key: string; client: GoogleGenAI } | null = null;

/** @throws MissingKeyError when the user has not supplied a key. */
export function getClient(): GoogleGenAI {
  const key = getApiKey();
  if (!key) throw new MissingKeyError();
  if (cached?.key !== key) cached = { key, client: new GoogleGenAI({ apiKey: key }) };
  return cached.client;
}

export function resetClientCache(): void {
  cached = null;
}
```

- [ ] **Step 8: Write the failing cover-chain test**

Create `src/lib/covers/index.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchCover } from './index';
import { placeholderCover } from './placeholder';

function mockFetch(handler: (url: string) => unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const result = handler(String(input));
      if (result === null) return new Response('', { status: 404 });
      return new Response(JSON.stringify(result), { status: 200 });
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchCover', () => {
  it('prefers Google Books and upgrades http to https', async () => {
    mockFetch((url) =>
      url.includes('googleapis.com')
        ? { items: [{ volumeInfo: { imageLinks: { large: 'http://books.test/large.jpg' } } }] }
        : null,
    );

    await expect(fetchCover('Atomic Habits', 'James Clear')).resolves.toBe(
      'https://books.test/large.jpg',
    );
  });

  it('falls back to OpenLibrary when Google Books has no cover', async () => {
    mockFetch((url) => {
      if (url.includes('googleapis.com')) return { items: [] };
      if (url.includes('openlibrary.org')) return { docs: [{ cover_i: 12345 }] };
      return null;
    });

    await expect(fetchCover('Deep Work', 'Cal Newport')).resolves.toBe(
      'https://covers.openlibrary.org/b/id/12345-L.jpg',
    );
  });

  it('falls back to a local placeholder when both APIs miss', async () => {
    mockFetch(() => ({ items: [], docs: [] }));

    const cover = await fetchCover('Nothing Found', 'Nobody');
    expect(cover).toBe(placeholderCover('Nothing Found'));
    expect(cover.startsWith('data:image/svg+xml,')).toBe(true);
  });

  it('falls back to the placeholder when the network throws', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    await expect(fetchCover('Offline', 'Nobody')).resolves.toBe(placeholderCover('Offline'));
  });

  it('never calls a Gemini endpoint', async () => {
    const spy = vi.fn(async () => new Response(JSON.stringify({ items: [], docs: [] })));
    vi.stubGlobal('fetch', spy);

    await fetchCover('Anything', 'Anyone');

    for (const call of spy.mock.calls) {
      expect(String(call[0])).not.toContain('generativelanguage');
    }
  });
});
```

- [ ] **Step 9: Write the cover modules**

`src/lib/covers/placeholder.ts`:

```ts
/** A deterministic, dependency-free cover. Replaces the ui-avatars.com calls. */
export function placeholderCover(title: string): string {
  const initials =
    title
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word.charAt(0))
      .join('')
      .toUpperCase() || '?';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400"><rect width="300" height="400" fill="#f97316"/><text x="150" y="200" font-family="Georgia,serif" font-size="120" font-weight="bold" fill="#ffffff" text-anchor="middle" dominant-baseline="central">${initials}</text></svg>`;

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
```

`src/lib/covers/googleBooks.ts`:

```ts
export async function fetchGoogleBooksCover(title: string, author: string): Promise<string | null> {
  const queries = [
    `intitle:${title}${author ? ` inauthor:${author}` : ''}`,
    `${title} ${author}`.trim(),
  ];

  for (const query of queries) {
    const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=3&printType=books`;
    const response = await fetch(url);
    if (!response.ok) continue;

    const data = (await response.json()) as {
      items?: { volumeInfo?: { imageLinks?: Record<string, string> } }[];
    };

    for (const item of data.items ?? []) {
      const links = item.volumeInfo?.imageLinks;
      const url =
        links?.extraLarge ??
        links?.large ??
        links?.medium ??
        links?.thumbnail ??
        links?.smallThumbnail;
      if (url) return url.replace(/^http:\/\//, 'https://');
    }
  }

  return null;
}
```

`src/lib/covers/openLibrary.ts`:

```ts
export async function fetchOpenLibraryCover(title: string, author: string): Promise<string | null> {
  const query = encodeURIComponent(`${title} ${author}`.trim());
  const response = await fetch(`https://openlibrary.org/search.json?q=${query}&limit=1`);
  if (!response.ok) return null;

  const data = (await response.json()) as { docs?: { cover_i?: number }[] };
  const coverId = data.docs?.[0]?.cover_i;
  return coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : null;
}
```

`src/lib/covers/index.ts`:

```ts
import { fetchGoogleBooksCover } from './googleBooks';
import { fetchOpenLibraryCover } from './openLibrary';
import { placeholderCover } from './placeholder';

export { placeholderCover };

/**
 * Free sources first, then a locally generated placeholder.
 * Deliberately makes no Gemini call — the old image-model search step cost a
 * request per cover and regexed a URL out of prose.
 */
export async function fetchCover(title: string, author: string): Promise<string> {
  for (const lookup of [fetchGoogleBooksCover, fetchOpenLibraryCover]) {
    try {
      const url = await lookup(title, author);
      if (url) return url;
    } catch {
      // Fall through to the next source.
    }
  }
  return placeholderCover(title);
}
```

- [ ] **Step 10: Run the cover tests**

Run: `npm test -- src/lib/covers/index.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 11: Move the WAV encoder and test it**

Create `src/lib/audio/wav.ts` — the body of `base64PCMToWavBlob` from `geminiService.ts:371-409`, taking bytes instead of base64:

```ts
const SAMPLE_RATE = 24_000;
const NUM_CHANNELS = 1;
const BITS_PER_SAMPLE = 16;

function writeString(view: DataView, offset: number, value: string) {
  for (let i = 0; i < value.length; i += 1) {
    view.setUint8(offset + i, value.charCodeAt(i));
  }
}

/** Gemini TTS returns headerless 24kHz mono 16-bit PCM; browsers need a RIFF header. */
export function pcmToWavBlob(pcm: Uint8Array): Blob {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const byteRate = SAMPLE_RATE * NUM_CHANNELS * (BITS_PER_SAMPLE / 8);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + pcm.length, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, NUM_CHANNELS, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, NUM_CHANNELS * (BITS_PER_SAMPLE / 8), true);
  view.setUint16(34, BITS_PER_SAMPLE, true);
  writeString(view, 36, 'data');
  view.setUint32(40, pcm.length, true);

  return new Blob([header, pcm], { type: 'audio/wav' });
}
```

Create `src/lib/audio/wav.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { pcmToWavBlob } from './wav';

async function headerOf(blob: Blob) {
  return new DataView(await blob.slice(0, 44).arrayBuffer());
}

const ascii = (view: DataView, offset: number, length: number) =>
  Array.from({ length }, (_, i) => String.fromCharCode(view.getUint8(offset + i))).join('');

describe('pcmToWavBlob', () => {
  it('produces a RIFF/WAVE container of the right size', async () => {
    const pcm = new Uint8Array(1000);
    const blob = pcmToWavBlob(pcm);

    expect(blob.type).toBe('audio/wav');
    expect(blob.size).toBe(44 + pcm.length);

    const view = await headerOf(blob);
    expect(ascii(view, 0, 4)).toBe('RIFF');
    expect(ascii(view, 8, 4)).toBe('WAVE');
    expect(ascii(view, 36, 4)).toBe('data');
    expect(view.getUint32(4, true)).toBe(36 + pcm.length);
    expect(view.getUint32(40, true)).toBe(pcm.length);
  });

  it('declares 24kHz mono 16-bit PCM', async () => {
    const view = await headerOf(pcmToWavBlob(new Uint8Array(8)));
    expect(view.getUint16(20, true)).toBe(1);
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(24_000);
    expect(view.getUint16(34, true)).toBe(16);
    expect(view.getUint32(28, true)).toBe(24_000 * 2);
  });
});
```

- [ ] **Step 12: Split `geminiService.ts` into `src/lib/ai/*`**

Move verbatim, changing only the client source, the model constants, the return shapes, and the error wrapping:

- `schemas.ts` — `GENERIC_BOOK_SCHEMA`, `RECOMMENDATION_SCHEMA`, `QUIZ_SCHEMA` from `geminiService.ts:7-73`.
- `prompts.ts` — the prompt template strings from `summarizeBook`, `summarizePdf`, `generateDetailedSummary`, `getAIRecommendations`, `generateBookQuiz`, and the chat `systemInstruction`, each as a function returning a string.
- `summarize.ts` — `summarizeBook(title, author)` and `summarizePdf(base64)` now return `{ book: BookDraft; summary: Omit<Summary,'id'|'bookId'> }` instead of a `BookInsight`, and `generateDetailedSummary(book, summary)` returns a string.
- `quiz.ts`, `chat.ts`, `recommend.ts` — same call bodies, `getClient()` instead of the module-level `ai`.
- `tts.ts` — `generateAudioSummary(book, summary, type, voice: VoiceName)`; pass `voice` into `prebuiltVoiceConfig.voiceName` instead of the hardcoded `'Kore'`, and return a `Blob` via `pcmToWavBlob(base64ToBytes(...))` rather than a base64 string.

Every exported function wraps its body in `try { ... } catch (error) { throw toAiError(error); }`.

Delete `src/services/geminiService.ts` and update all importing components.

- [ ] **Step 13: Write `src/features/settings/ApiKeyDialog.tsx`**

```tsx
import { useState } from 'react';
import { ExternalLink, Loader2, ShieldAlert, X } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { setApiKey } from '../../lib/ai/apiKey';
import { MODELS } from '../../lib/ai/models';
import { toAiError } from '../../lib/ai/errors';

interface ApiKeyDialogProps {
  onClose: () => void;
  onSaved: () => void;
}

export function ApiKeyDialog({ onClose, onSaved }: ApiKeyDialogProps) {
  const [value, setValue] = useState('');
  const [status, setStatus] = useState<'idle' | 'testing' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!value.trim()) return;

    setStatus('testing');
    setMessage(null);
    try {
      const probe = new GoogleGenAI({ apiKey: value.trim() });
      await probe.models.generateContent({ model: MODELS.summary, contents: 'ping' });
      setApiKey(value);
      onSaved();
      onClose();
    } catch (error) {
      setStatus('error');
      setMessage(toAiError(error).message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl p-6 sm:p-8">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-2xl font-bold text-gray-900">Connect Gemini</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
            <X size={20} />
          </button>
        </div>

        <p className="text-sm text-gray-600 leading-relaxed mb-4">
          BookSum uses Google&rsquo;s Gemini to write summaries, narrate them, and answer questions
          about your books. Bring your own key — it is stored in this browser only and is sent
          nowhere except Google.
        </p>

        <a
          href="https://aistudio.google.com/apikey"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-orange-600 hover:text-orange-700 mb-6"
        >
          Get a free key <ExternalLink size={14} />
        </a>

        <form onSubmit={handleSave} className="space-y-4">
          <input
            type="password"
            autoComplete="off"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="AIza..."
            className="w-full px-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none font-mono text-sm"
          />

          {message && (
            <p className="flex items-start gap-2 p-4 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100">
              <ShieldAlert size={16} className="mt-0.5 shrink-0" /> {message}
            </p>
          )}

          <button
            type="submit"
            disabled={!value.trim() || status === 'testing'}
            className="w-full py-4 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white rounded-2xl font-bold shadow-lg shadow-orange-200 transition-all flex items-center justify-center gap-2"
          >
            {status === 'testing' && <Loader2 size={18} className="animate-spin" />}
            {status === 'testing' ? 'Testing key…' : 'Test and save'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 14: Gate the AI actions**

In `App.tsx`, hold `const [showKeyDialog, setShowKeyDialog] = useState(false);` and render `<ApiKeyDialog />` when true. Every AI call site — `AddBookModal` submit, `BookDetail`'s detailed-summary / audio / chat / quiz buttons, and the recommendations refresh — wraps its handler:

```tsx
try {
  await doTheAiThing();
} catch (error) {
  const aiError = toAiError(error);
  if (aiError.kind === 'missing-key' || aiError.kind === 'invalid-key') {
    setShowKeyDialog(true);
    return;
  }
  setError(aiError.message);
}
```

Non-AI features must keep working with no key: the library, notes, reading, stats and profile screens make no AI call on load.

- [ ] **Step 15: Remove the automatic recommendations call**

Delete the effect at `App.tsx:152-177`. Replace with an explicit refresh button in the "Recommended For You" header and a 24h cache:

```tsx
const RECS_CACHE_KEY = 'booksum.recs';
const RECS_TTL_MS = 24 * 60 * 60 * 1000;

const refreshRecommendations = async () => {
  if (!profile || books.length === 0) return;
  setIsRefreshingRecs(true);
  try {
    const next = await getAIRecommendations(books);
    setRecommendations(next);
    localStorage.setItem(
      `${RECS_CACHE_KEY}.${profile.id}`,
      JSON.stringify({ at: Date.now(), items: next }),
    );
  } catch (error) {
    const aiError = toAiError(error);
    if (aiError.kind === 'missing-key') setShowKeyDialog(true);
  } finally {
    setIsRefreshingRecs(false);
  }
};
```

On mount, read the cache and use it when `Date.now() - at < RECS_TTL_MS`; otherwise show `RECOMMENDED_BOOKS`. **No AI call fires on load.**

- [ ] **Step 16: Run the gate**

```bash
npm run typecheck && npm test && npm run build
grep -rn "generativelanguage\|ui-avatars" src/ ; echo "grep exit: $?"
```

Expected: tests and build pass; the grep finds nothing (`exit: 1`) — every `ui-avatars.com` reference in `App.tsx` and `AuthContext` has been replaced by `placeholderCover`.

- [ ] **Step 17: Manual verification**

```bash
npm run dev
```

With no key: create a profile, confirm the library, stats and profile screens all render and the Network tab shows no request to `generativelanguage.googleapis.com`. Click "Add Book" → submit → the key dialog opens. Paste an invalid key → it reports "That API key was rejected." Paste a valid key → a book summarises, and the cover loads from Google Books or OpenLibrary.

- [ ] **Step 18: Commit**

```bash
git add -A
git commit -m "feat(ai): split the Gemini service, gate on a user-supplied key

- geminiService.ts becomes lib/ai/* + lib/covers/* + lib/audio/wav.ts
- Key comes from the user at runtime; MissingKeyError opens the key dialog
- Typed AiError replaces the single catch-all error string
- Cover chain drops the Gemini image-model search step and ui-avatars.com
- Recommendations are explicit and cached 24h instead of firing on every change
- TTS honours profile.favoriteVoice instead of hardcoding Kore"
```

---

## Task 7: Phase 1 verification and README

**Files:**

- Modify: `README.md`
- Create: `.env.example`
- Depends on: Tasks 1–6

**Interfaces:**

- Consumes: everything
- Produces: a repository a stranger can clone and run

- [ ] **Step 1: Replace `README.md`**

````markdown
# BookSum

Turn any book into a summary, key insights, narrated audio, and a quiz — then keep track of what
you have read. Everything is stored in your browser; there is no server and no account.

## Run it

**Prerequisites:** Node.js 20.19 or newer.

```bash
npm install
npm run dev
```

Open the printed URL, create a profile, and paste a Gemini API key when BookSum asks for one.
[Get a free key](https://aistudio.google.com/apikey).

## About the API key

BookSum is bring-your-own-key. Your key is stored in your browser's `localStorage` and is sent
only to Google's Gemini API. It is never bundled into the build, never committed, and never sent
to any other server.

Without a key you can still use your library, notes, reading view, stats and profiles. Only the AI
features — summarising, audio, chat, quizzes and recommendations — need one.

## Scripts

| Command              | What it does                     |
| -------------------- | -------------------------------- |
| `npm run dev`        | Start the dev server             |
| `npm run build`      | Typecheck, then build to `dist/` |
| `npm run preview`    | Serve the production build       |
| `npm run typecheck`  | `tsc --noEmit`                   |
| `npm test`           | Run the test suite once          |
| `npm run test:watch` | Run tests in watch mode          |

## Architecture

```
src/lib/       React-free modules: storage (IndexedDB), AI, covers, audio
src/features/  React feature folders: profile, library, settings
src/components/ Shared UI
```

`src/lib` never imports React. `src/features` and `src/components` never import `idb` or
`@google/genai` directly — they go through `src/lib/storage/repo.ts` and `src/lib/ai/*`.

Books, summaries and profiles live in IndexedDB. PDFs and generated audio are stored as `Blob`s in
a separate object store, so a large upload cannot break persistence.
````

- [ ] **Step 2: Create `.env.example`**

```bash
# BookSum needs no build-time environment variables.
#
# The Gemini API key is supplied by each user at runtime and stored in their
# browser. Do not add an API key here, and do not add a `define` entry for one
# in vite.config.ts — it would be inlined into the JavaScript bundle and
# readable by anyone who loads the site.
```

- [ ] **Step 3: Run the full Phase 1 gate**

```bash
rm -rf node_modules dist
npm install
npm run typecheck
npm test
npm run build
grep -rn "AIza" dist/ ; echo "key grep exit: $?"
grep -rn "booksum_db_users\|pdfData\|audioData" src/ ; echo "legacy grep exit: $?"
```

Expected: install, typecheck, tests and build all succeed. Both greps exit `1` except for the
deliberate references inside `src/lib/storage/migrate.ts`, which reads the legacy shapes on purpose.

- [ ] **Step 4: Verify the Phase 1 acceptance criteria by hand**

```bash
npm run preview
```

- [ ] A clean clone installs and builds.
- [ ] No key appears anywhere in `dist/`.
- [ ] With no key set, the app loads, a profile can be created, and no request goes to `generativelanguage.googleapis.com`.
- [ ] Uploading a 10MB PDF succeeds and the library still persists after a reload.
- [ ] Switching profiles shows a different library.
- [ ] DevTools → Application → IndexedDB → `booksum` shows all five object stores.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "docs: rewrite README for the BYOK local-first setup

Documents the real prerequisites, scripts, key handling and architecture,
replacing the AI Studio boilerplate."
```

---

## Phase 1 Done When

- `git clone && npm install && npm run dev` works on a machine that has never seen this project.
- `npm run build` produces a `dist/` with no key in it.
- The app is fully usable without a Gemini key, and each AI action asks for one exactly when it is needed.
- Library data lives in IndexedDB, binary data lives in the blob store, and a 10MB PDF does not break persistence.
- No plaintext password code remains anywhere in the working tree.
- `npm test` is green: storage, migration, profiles, library, AI errors, key handling, covers, WAV, smoke.

Next: `docs/superpowers/plans/` gets a Phase 2 plan (routing, `App.tsx` decomposition, accessible dialogs, toasts, lint, CI).
