# BookSum Phase 3 — Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the four capabilities that make BookSum worth keeping open — dark mode, Markdown export, Goodreads import, and a spaced-repetition review queue that turns generated quizzes into actual retention.

**Architecture:** Three of the four are pure functions in `src/lib` with a thin UI on top (`markdown.ts`, `goodreads.ts`, `srs.ts`), which keeps them fully testable without a renderer. Dark mode is CSS-variable driven: semantic colour tokens defined once, flipped by a `.dark` class on `<html>`, so components opt in via `dark:` variants rather than each inventing a palette.

**Tech Stack:** Tailwind v4 `@custom-variant` · existing IndexedDB `reviewCards` store (created in the v1 schema, unused until now)

**Source spec:** `docs/superpowers/specs/2026-08-11-booksum-overhaul-design.md`
**Builds on:** Phases 1 and 2 (complete)

## Scope change from the spec

The user dropped three items on 2026-08-12. **Not building:** full-text search across summaries and notes, the ⌘K command palette, and the installable offline PWA. The spec's §11 table is otherwise unchanged.

## Global Constraints

- **Every commit leaves `npm run typecheck`, `npm run lint`, `npm run format:check` and `npm test` green.**
- **Layering holds:** `src/lib/**` imports no React; `src/features/**` and `src/components/**` never import `idb` or `@google/genai` directly.
- **Goodreads import makes zero AI calls.** Importing 300 books must cost nothing.
- **No new `alert()` or `confirm()`** — ESLint enforces it.
- **Dark mode is a colour change only.** No layout, spacing or component structure changes ride along.
- **Contrast holds in both themes:** text meets WCAG AA (4.5:1), verified with `contrastRatio` from `src/lib/contrast.ts`.

---

## File Structure

| File                                    | Responsibility                                                      |
| --------------------------------------- | ------------------------------------------------------------------- |
| `src/index.css`                         | Semantic colour tokens + `@custom-variant dark`                     |
| `src/features/settings/useTheme.ts`     | Resolves system/light/dark, applies the class, persists per profile |
| `src/features/settings/ThemeToggle.tsx` | Three-way control                                                   |
| `src/lib/markdown.ts`                   | `bookToMarkdown`, `libraryToMarkdown`                               |
| `src/lib/goodreads.ts`                  | `parseGoodreadsCsv` → rows + a duplicate/skip report                |
| `src/lib/srs.ts`                        | `scheduleCard`, `isDue`, `newCard` (SM-2-lite)                      |
| `src/features/review/ReviewPage.tsx`    | `/review` route — the due queue                                     |
| `src/features/review/useReviewQueue.ts` | Loads due cards, records grades                                     |
| `src/lib/storage/repo.ts`               | Gains a `reviewCards` section                                       |

---

## Task 1: Dark mode

**Files:**

- Modify: `src/index.css`, `src/app/AppShell.tsx`, `src/components/*`, `src/features/*`
- Create: `src/features/settings/useTheme.ts`, `src/features/settings/ThemeToggle.tsx`, `src/features/settings/useTheme.test.tsx`

**Interfaces:**

- Consumes: `profile.theme` (already `'system' | 'light' | 'dark'` on `Profile`), `updateProfile`
- Produces: `useTheme(): { theme, resolved, setTheme }`, `<ThemeToggle />`

- [ ] **Step 1: Write the failing theme test**

Create `src/features/settings/useTheme.test.tsx`:

```tsx
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ACTIVE_PROFILE_KEY, ProfileProvider } from '../profile/ProfileContext';
import { resetDb } from '../../lib/storage/db';
import { profiles } from '../../lib/storage/repo';
import { useTheme } from './useTheme';

let api: ReturnType<typeof useTheme>;

function Probe() {
  api = useTheme();
  return <p data-testid="resolved">{api.resolved}</p>;
}

async function renderWithTheme(theme: 'system' | 'light' | 'dark') {
  const profile = await profiles.create({ name: 'Dorian', theme });
  localStorage.setItem(ACTIVE_PROFILE_KEY, profile.id);
  render(
    <ProfileProvider>
      <Probe />
    </ProfileProvider>,
  );
  return profile;
}

function mockPrefersDark(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
      onchange: null,
    })),
  );
}

beforeEach(async () => {
  await resetDb();
  localStorage.clear();
  document.documentElement.classList.remove('dark');
  mockPrefersDark(false);
});

describe('useTheme', () => {
  it('applies the dark class when the profile asks for dark', async () => {
    await renderWithTheme('dark');
    await waitFor(() => expect(document.documentElement).toHaveClass('dark'));
  });

  it('removes the dark class for a light profile', async () => {
    document.documentElement.classList.add('dark');
    await renderWithTheme('light');
    await waitFor(() => expect(document.documentElement).not.toHaveClass('dark'));
  });

  it('follows the system preference when set to system', async () => {
    mockPrefersDark(true);
    await renderWithTheme('system');
    await waitFor(() => expect(document.documentElement).toHaveClass('dark'));
  });

  it('resolves system to light when the system is light', async () => {
    mockPrefersDark(false);
    await renderWithTheme('system');
    await waitFor(() => expect(document.documentElement).not.toHaveClass('dark'));
  });

  it('persists a change to the profile', async () => {
    const profile = await renderWithTheme('light');
    await waitFor(() => expect(api).toBeDefined());

    await api.setTheme('dark');

    await waitFor(async () => expect((await profiles.get(profile.id))?.theme).toBe('dark'));
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- src/features/settings/useTheme.test.tsx`
Expected: FAIL — `Failed to resolve import "./useTheme"`.

- [ ] **Step 3: Write `src/features/settings/useTheme.ts`**

```ts
import { useCallback, useEffect, useState } from 'react';
import { useProfile } from '../profile/ProfileContext';
import type { Profile } from '../../types';

export type ThemeChoice = Profile['theme'];
export type ResolvedTheme = 'light' | 'dark';

function systemPrefersDark(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
}

export function useTheme() {
  const { profile, updateProfile } = useProfile();
  const theme: ThemeChoice = profile?.theme ?? 'system';
  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const query = matchMedia('(prefers-color-scheme: dark)');
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    query.addEventListener?.('change', onChange);
    return () => query.removeEventListener?.('change', onChange);
  }, []);

  const resolved: ResolvedTheme = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;

  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolved === 'dark');
  }, [resolved]);

  const setTheme = useCallback(
    async (next: ThemeChoice) => {
      if (!profile) return;
      await updateProfile({ ...profile, theme: next });
    },
    [profile, updateProfile],
  );

  return { theme, resolved, setTheme };
}
```

- [ ] **Step 4: Add the variant and tokens to `src/index.css`**

```css
@import 'tailwindcss';

@custom-variant dark (&:where(.dark, .dark *));

@theme {
  --font-sans: 'Inter', ui-sans-serif, system-ui, sans-serif;
  --font-serif: 'Playfair Display', ui-serif, Georgia, serif;
  --color-parchment: #fcfcf9;
  --color-night: #14110f;
}

@layer base {
  body {
    font-family: var(--font-sans);
    background-color: var(--color-parchment);
  }

  .dark body {
    background-color: var(--color-night);
    color: var(--color-gray-100);
  }
}
```

- [ ] **Step 5: Add `dark:` variants across the surfaces**

Mechanical, and the only colour classes that need pairing:

| Light class                     | Add                    |
| ------------------------------- | ---------------------- |
| `bg-white`                      | `dark:bg-gray-900`     |
| `bg-parchment` / `bg-[#fcfcf9]` | `dark:bg-night`        |
| `bg-gray-50`                    | `dark:bg-gray-800`     |
| `bg-gray-100`                   | `dark:bg-gray-800`     |
| `text-gray-900`                 | `dark:text-gray-100`   |
| `text-gray-700`                 | `dark:text-gray-300`   |
| `text-gray-600`                 | `dark:text-gray-400`   |
| `text-gray-500`                 | `dark:text-gray-400`   |
| `border-gray-100`               | `dark:border-gray-800` |
| `border-gray-200`               | `dark:border-gray-700` |
| `text-orange-700`               | `dark:text-orange-400` |
| `bg-orange-50`                  | `dark:bg-orange-950`   |

**Do not touch `src/components/EReader.tsx`** — it has its own light/sepia/dark reader theme and would fight this one.

- [ ] **Step 6: Add `ThemeToggle` and mount it**

`ThemeToggle.tsx` renders three `aria-pressed` buttons (System / Light / Dark) calling `setTheme`. Mount it in `ProfileView`'s settings area.

- [ ] **Step 7: Verify contrast in dark**

Extend `src/lib/contrast.test.ts`:

```ts
const NIGHT = '#14110f';

describe('dark theme meets WCAG AA', () => {
  it('passes for body text on the night background', () => {
    expect(contrastRatio('#f3f4f6', NIGHT)).toBeGreaterThanOrEqual(4.5);
  });

  it('passes for the accent colour on the night background', () => {
    expect(contrastRatio('#fb923c', NIGHT)).toBeGreaterThanOrEqual(4.5);
  });
});
```

- [ ] **Step 8: Verify and commit**

```bash
npm run typecheck && npm run lint && npm test
git add -A
git commit -m "feat(theme): add dark mode

Follows the system preference by default; a per-profile override persists.
EReader keeps its own reader themes."
```

---

## Task 2: Markdown export

**Files:**

- Create: `src/lib/markdown.ts`, `src/lib/markdown.test.ts`
- Modify: `src/components/BookDetail.tsx`, `src/components/ProfileView.tsx`

**Interfaces:**

- Produces: `bookToMarkdown(book, summary?): string`, `libraryToMarkdown(entries): string` where `entries` is `{ book: Book; summary?: Summary }[]`

- [ ] **Step 1: Write the failing test**

Create `src/lib/markdown.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { bookToMarkdown, libraryToMarkdown } from './markdown';
import type { Book, Summary } from '../types';

const book: Book = {
  id: 'b1',
  profileId: 'p1',
  title: 'Atomic Habits',
  author: 'James Clear',
  category: 'Productivity',
  status: 'Finished',
  rating: 5,
  readingTimeMinutes: 12,
  coverImageUrl: '',
  addedAt: '2026-02-01T00:00:00.000Z',
  hasPdf: false,
  personalNotes: 'Start with two minutes.',
};

const summary: Summary = {
  id: 's1',
  bookId: 'b1',
  oneSentenceTakeaway: 'Small changes compound.',
  summary: 'A body paragraph.',
  keyInsights: ['Systems beat goals.', 'Identity drives habit.'],
  actionableSteps: ['Habit stack.'],
  generatedAt: '2026-02-01T00:00:00.000Z',
  model: 'test-model',
};

describe('bookToMarkdown', () => {
  it('leads with a title and author', () => {
    const md = bookToMarkdown(book, summary);
    expect(md.startsWith('# Atomic Habits\n')).toBe(true);
    expect(md).toContain('*by James Clear*');
  });

  it('includes the takeaway, insights, steps and notes', () => {
    const md = bookToMarkdown(book, summary);
    expect(md).toContain('> Small changes compound.');
    expect(md).toContain('- Systems beat goals.');
    expect(md).toContain('- Habit stack.');
    expect(md).toContain('Start with two minutes.');
  });

  it('handles a book with no summary', () => {
    const md = bookToMarkdown(book, undefined);
    expect(md).toContain('# Atomic Habits');
    expect(md).toContain('Not summarised yet.');
    expect(md).not.toContain('## Key Insights');
  });

  it('omits the notes section when there are none', () => {
    const md = bookToMarkdown({ ...book, personalNotes: undefined }, summary);
    expect(md).not.toContain('## My Notes');
  });

  it('is deterministic', () => {
    expect(bookToMarkdown(book, summary)).toBe(bookToMarkdown(book, summary));
  });
});

describe('libraryToMarkdown', () => {
  it('writes a heading and one section per book', () => {
    const md = libraryToMarkdown([
      { book, summary },
      { book: { ...book, id: 'b2', title: 'Deep Work' }, summary: undefined },
    ]);
    expect(md).toContain('# My BookSum Library');
    expect(md).toContain('Atomic Habits');
    expect(md).toContain('Deep Work');
    expect(md).toContain('2 books');
  });

  it('handles an empty library', () => {
    expect(libraryToMarkdown([])).toContain('0 books');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- src/lib/markdown.test.ts`
Expected: FAIL — `Failed to resolve import "./markdown"`.

- [ ] **Step 3: Write `src/lib/markdown.ts`**

```ts
import type { Book, Summary } from '../types';

export interface LibraryEntry {
  book: Book;
  summary?: Summary;
}

export function bookToMarkdown(book: Book, summary?: Summary): string {
  const lines: string[] = [`# ${book.title}`, '', `*by ${book.author}*`, ''];

  lines.push(
    `**Status:** ${book.status}  `,
    `**Category:** ${book.category}  `,
    `**Rating:** ${book.rating}/5  `,
    `**Reading time:** ${book.readingTimeMinutes} min`,
    '',
  );

  if (!summary) {
    lines.push('Not summarised yet.', '');
  } else {
    lines.push(`> ${summary.oneSentenceTakeaway}`, '', '## Summary', '', summary.summary, '');

    if (summary.keyInsights.length > 0) {
      lines.push('## Key Insights', '', ...summary.keyInsights.map((i) => `- ${i}`), '');
    }
    if (summary.actionableSteps.length > 0) {
      lines.push('## Actionable Steps', '', ...summary.actionableSteps.map((s) => `- ${s}`), '');
    }
    if (summary.detailedSummary) {
      lines.push('## Deep Dive', '', summary.detailedSummary, '');
    }
  }

  if (book.personalNotes?.trim()) {
    lines.push('## My Notes', '', book.personalNotes.trim(), '');
  }

  return lines.join('\n');
}

export function libraryToMarkdown(entries: LibraryEntry[]): string {
  const header = [
    '# My BookSum Library',
    '',
    `${entries.length} book${entries.length === 1 ? '' : 's'}`,
    '',
    '---',
    '',
  ];

  const body = entries.map(({ book, summary }) => bookToMarkdown(book, summary));
  return [...header, body.join('\n---\n\n')].join('\n');
}
```

- [ ] **Step 4: Wire up the download buttons**

A shared `downloadText(filename, contents)` helper (put it in `src/lib/download.ts`) creates a Blob, an object URL, clicks a temporary anchor, and revokes the URL.

- `BookDetail` gains an "Export Markdown" action next to the existing share control.
- `ProfileView` gains "Export library as Markdown" beside the existing JSON export.

- [ ] **Step 5: Verify and commit**

```bash
npm run typecheck && npm run lint && npm test
git add -A
git commit -m "feat(export): export a book or the whole library as Markdown"
```

---

## Task 3: Goodreads CSV import

**Files:**

- Create: `src/lib/goodreads.ts`, `src/lib/goodreads.test.ts`, `src/features/library/GoodreadsImportDialog.tsx`
- Modify: `src/components/AddBookModal.tsx` (third mode), `src/features/library/useLibrary.tsx`

**Interfaces:**

- Produces: `parseGoodreadsCsv(text): { rows: GoodreadsRow[]; skipped: number }` where `GoodreadsRow = { title, author, status, rating, isbn13?, dateRead? }`

- [ ] **Step 1: Write the failing parser test**

Create `src/lib/goodreads.test.ts`. Goodreads exports quote fields containing commas, wrap ISBNs as `="9780735211292"`, and use an `Exclusive Shelf` column of `read` / `to-read` / `currently-reading`.

```ts
import { describe, expect, it } from 'vitest';
import { parseGoodreadsCsv } from './goodreads';

const HEADER = 'Book Id,Title,Author,My Rating,Exclusive Shelf,ISBN13,Date Read';

function csv(...rows: string[]) {
  return [HEADER, ...rows].join('\n');
}

describe('parseGoodreadsCsv', () => {
  it('parses a simple row', () => {
    const { rows } = parseGoodreadsCsv(
      csv('123,Atomic Habits,James Clear,5,read,="9780735211292",2026/02/01'),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      title: 'Atomic Habits',
      author: 'James Clear',
      rating: 5,
      status: 'Finished',
      isbn13: '9780735211292',
    });
  });

  it('maps to-read to Want to Read', () => {
    const { rows } = parseGoodreadsCsv(csv('1,Deep Work,Cal Newport,0,to-read,="",'));
    expect(rows[0]?.status).toBe('Want to Read');
  });

  it('treats currently-reading as Want to Read', () => {
    const { rows } = parseGoodreadsCsv(csv('1,Sapiens,Harari,0,currently-reading,="",'));
    expect(rows[0]?.status).toBe('Want to Read');
  });

  it('handles quoted fields containing commas', () => {
    const { rows } = parseGoodreadsCsv(
      csv('1,"Sapiens: A Brief History, Illustrated",Harari,4,read,="",'),
    );
    expect(rows[0]?.title).toBe('Sapiens: A Brief History, Illustrated');
  });

  it('handles escaped double quotes inside a quoted field', () => {
    const { rows } = parseGoodreadsCsv(csv('1,"The ""Good"" Book",Someone,3,read,="",'));
    expect(rows[0]?.title).toBe('The "Good" Book');
  });

  it('strips the Goodreads ="..." ISBN wrapper and drops empties', () => {
    const { rows } = parseGoodreadsCsv(csv('1,X,Y,0,to-read,="",'));
    expect(rows[0]?.isbn13).toBeUndefined();
  });

  it('skips rows with no title and reports the count', () => {
    const { rows, skipped } = parseGoodreadsCsv(
      csv('1,,No Title,0,read,="",', '2,Real,A,1,read,="",'),
    );
    expect(rows).toHaveLength(1);
    expect(skipped).toBe(1);
  });

  it('returns nothing for an empty or header-only file', () => {
    expect(parseGoodreadsCsv('').rows).toHaveLength(0);
    expect(parseGoodreadsCsv(HEADER).rows).toHaveLength(0);
  });

  it('tolerates a missing optional column', () => {
    const { rows } = parseGoodreadsCsv('Title,Author,Exclusive Shelf\nDune,Herbert,read');
    expect(rows[0]).toMatchObject({ title: 'Dune', author: 'Herbert', status: 'Finished' });
    expect(rows[0]?.rating).toBe(0);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- src/lib/goodreads.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/lib/goodreads.ts`**

Implement a small RFC4180-ish reader (quoted fields, doubled quotes, commas inside quotes), then map by header name so column order does not matter. Rows without a title are skipped and counted.

- [ ] **Step 4: Add `importGoodreadsRows` to `useLibrary`**

Creates one `Book` per row with `readingTimeMinutes: 0`, no `summaryId`, cover from `isbn13` (`https://covers.openlibrary.org/b/isbn/<isbn>-L.jpg`) or the local placeholder. **No AI calls.** Skips rows whose title and author already exist in the library, and returns `{ added, duplicates }`.

- [ ] **Step 5: Add the import UI**

`GoodreadsImportDialog` uses the `Dialog` primitive: file picker → parsed preview (count, how many are new, how many duplicates, how many skipped) → confirm. Reached from a third tab in `AddBookModal` labelled "Goodreads".

- [ ] **Step 6: Add the integration test**

`src/features/library/goodreadsImport.test.tsx` — importing a two-row CSV adds two books, a second import of the same file adds zero, and `fetch` is never called with a `generativelanguage` URL.

- [ ] **Step 7: Verify and commit**

```bash
npm run typecheck && npm run lint && npm test
git add -A
git commit -m "feat(import): import a Goodreads CSV export

Zero AI calls: rows become library entries, summaries are generated later on
demand. Duplicates by title+author are skipped and reported."
```

---

## Task 4: Spaced-repetition review

**Files:**

- Create: `src/lib/srs.ts`, `src/lib/srs.test.ts`, `src/features/review/useReviewQueue.ts`, `src/features/review/ReviewPage.tsx`, `src/features/review/reviewQueue.test.tsx`
- Modify: `src/lib/storage/repo.ts`, `src/components/QuizModal.tsx`, `src/app/routes.tsx`, `src/app/AppShell.tsx`

**Interfaces:**

- Produces: `newCard(input): ReviewCard`, `scheduleCard(card, grade, now): ReviewCard`, `isDue(card, now): boolean`; repo gains `reviewCards.listDue(profileId, now)`, `.upsert(card)`, `.removeByBook(bookId)`

**Grades:** 1 = again, 2 = hard, 3 = good, 4 = easy.

- [ ] **Step 1: Write the failing SRS test**

Create `src/lib/srs.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { isDue, newCard, scheduleCard } from './srs';
import type { ReviewCard } from '../types';

const NOW = new Date('2026-08-12T00:00:00.000Z');

function card(overrides: Partial<ReviewCard> = {}): ReviewCard {
  return {
    ...newCard({
      profileId: 'p1',
      bookId: 'b1',
      question: 'Q',
      options: ['a', 'b', 'c', 'd'],
      correctAnswerIndex: 0,
      explanation: 'because',
    }),
    ...overrides,
  };
}

describe('newCard', () => {
  it('starts due immediately with a one-day interval', () => {
    const created = newCard({
      profileId: 'p1',
      bookId: 'b1',
      question: 'Q',
      options: [],
      correctAnswerIndex: 0,
      explanation: '',
    });
    expect(created.intervalDays).toBe(1);
    expect(created.reviewCount).toBe(0);
    expect(created.ease).toBeCloseTo(2.5);
    expect(isDue(created, NOW)).toBe(true);
  });
});

describe('scheduleCard', () => {
  it('resets the interval on a failed recall', () => {
    const next = scheduleCard(card({ intervalDays: 10, ease: 2.5 }), 1, NOW);
    expect(next.intervalDays).toBe(1);
    expect(next.ease).toBeLessThan(2.5);
  });

  it('never lets ease fall below 1.3', () => {
    let current = card({ ease: 1.4 });
    for (let i = 0; i < 10; i += 1) current = scheduleCard(current, 1, NOW);
    expect(current.ease).toBeGreaterThanOrEqual(1.3);
  });

  it('grows the interval on a good recall', () => {
    const first = scheduleCard(card(), 3, NOW);
    const second = scheduleCard(first, 3, NOW);
    expect(second.intervalDays).toBeGreaterThan(first.intervalDays);
  });

  it('grows faster for easy than for good', () => {
    const good = scheduleCard(card({ intervalDays: 10 }), 3, NOW);
    const easy = scheduleCard(card({ intervalDays: 10 }), 4, NOW);
    expect(easy.intervalDays).toBeGreaterThan(good.intervalDays);
  });

  it('grows more slowly for hard than for good', () => {
    const hard = scheduleCard(card({ intervalDays: 10 }), 2, NOW);
    const good = scheduleCard(card({ intervalDays: 10 }), 3, NOW);
    expect(hard.intervalDays).toBeLessThan(good.intervalDays);
  });

  it('sets dueAt to now plus the new interval', () => {
    const next = scheduleCard(card({ intervalDays: 1 }), 3, NOW);
    const expected = NOW.getTime() + next.intervalDays * 24 * 60 * 60 * 1000;
    expect(Date.parse(next.dueAt)).toBe(expected);
  });

  it('counts each review', () => {
    expect(scheduleCard(card(), 3, NOW).reviewCount).toBe(1);
  });
});

describe('isDue', () => {
  it('is false before the due date', () => {
    const future = card({ dueAt: '2026-09-01T00:00:00.000Z' });
    expect(isDue(future, NOW)).toBe(false);
  });

  it('is true on the due date', () => {
    expect(isDue(card({ dueAt: NOW.toISOString() }), NOW)).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- src/lib/srs.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/lib/srs.ts`**

SM-2-lite. `ease` starts at 2.5, floors at 1.3, and moves by `+0.1` (easy), `0` (good), `-0.15` (hard), `-0.2` (again). Interval: grade 1 → 1 day; otherwise `round(interval * ease * modifier)` with modifier `0.6` (hard), `1` (good), `1.3` (easy), minimum 1 day. `dueAt = now + intervalDays`.

- [ ] **Step 4: Add `reviewCards` to the repo**

```ts
export const reviewCards = {
  async listByProfile(profileId: string): Promise<ReviewCard[]>,
  async listDue(profileId: string, now: Date): Promise<ReviewCard[]>,
  async upsert(card: ReviewCard): Promise<ReviewCard>,
  async removeByBook(bookId: string): Promise<void>,
};
```

`listDue` reads the `by-profile-due` index and filters on `dueAt <= now.toISOString()` (ISO strings sort chronologically). Add `reviewCards.removeByBook(id)` to `books.remove` so deleting a book takes its cards with it, and extend the cascade test in `repo.test.ts` to prove it.

- [ ] **Step 5: Save cards when a quiz is generated**

In `QuizModal`, after questions come back, upsert one card per question via `newCard`. Skip any question already stored for that book (match on question text) so re-taking a quiz does not duplicate cards.

- [ ] **Step 6: Write the review queue and page**

`useReviewQueue()` exposes `{ cards, current, isLoading, grade(g), remaining }`. `ReviewPage` shows the question, reveals the answer plus explanation, then offers the four grade buttons. Empty state: "Nothing due — come back later." Add the `/review` route and a Review nav item showing the due count.

- [ ] **Step 7: Write the integration test**

`src/features/review/reviewQueue.test.tsx` — a due card appears, grading `good` removes it from today's queue and pushes `dueAt` into the future, and grading `again` keeps it due.

- [ ] **Step 8: Verify and commit**

```bash
npm run typecheck && npm run lint && npm test
git add -A
git commit -m "feat(review): spaced-repetition queue over generated quiz questions"
```

---

## Task 5: Verification

- [ ] **Step 1: Full gate**

```bash
npm run typecheck && npm run lint && npm run format:check && npm test && npm run build
grep -roE "AIza[0-9A-Za-z_-]{35}" dist/ ; echo "expect no matches"
```

- [ ] **Step 2: Browser check via Playwright**

- [ ] Toggling to dark repaints the library, a dialog and the profile page; nothing is unreadable.
- [ ] The dark choice survives a reload.
- [ ] Importing a real Goodreads CSV adds books and makes no `generativelanguage` request.
- [ ] Exported Markdown opens correctly in a viewer.
- [ ] `/review` shows due cards and grading advances the queue.
- [ ] No console errors on any route in either theme.

- [ ] **Step 3: Update the README status and commit**

## Phase 3 Done When

- Dark mode follows the system by default, can be overridden per profile, persists, and meets AA in both themes.
- Any book and the whole library export as Markdown.
- A Goodreads CSV imports with zero AI calls, skipping and reporting duplicates.
- Generated quiz questions become review cards, and `/review` surfaces what is due with SM-2-lite scheduling.
- Typecheck, lint, format, tests and build all pass; CI runs them.

Next: Phase 4 — LICENSE, screenshots, CONTRIBUTING, SECURITY, issue templates, GitHub Pages deploy, and the public push.
