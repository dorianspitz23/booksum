# BookSum Phase 2 — Quality Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make BookSum navigable, keyboard-accessible, and continuously checked — the back button works, every dialog can be operated and escaped without a mouse, errors surface as UI rather than `alert()`, and lint/typecheck/test run on every push.

**Architecture:** `react-router` owns the view state that `useState<ViewState>` owns today, so each screen gets a real URL. `App.tsx` splits into a shell plus one page component per route. A single focus-trapping `Dialog` primitive replaces five hand-rolled modal shells. A toast store and a confirm dialog replace `alert()` and `confirm()`.

**Tech Stack:** react-router 8 · ESLint 9 flat config · typescript-eslint 8 · Prettier 3 · GitHub Actions

**Source spec:** `docs/superpowers/specs/2026-08-11-booksum-overhaul-design.md`
**Builds on:** `docs/superpowers/plans/2026-08-11-booksum-phase-1-foundation.md` (complete)

## Global Constraints

- **Every commit leaves `npm run typecheck`, `npm run lint` and `npm test` green.**
- **Layering holds:** `src/lib/**` imports no React. `src/features/**` and `src/components/**` never import `idb` or `@google/genai` directly.
- **No `alert()` or `confirm()` survives Task 4.** An ESLint rule enforces it from then on.
- **No key in the bundle.** Still verified by `grep -roE "AIza[0-9A-Za-z_-]{35}" dist/`.
- **Every dialog:** focus trap, Escape to close, focus restored to the trigger, `aria-modal="true"`, labelled by its heading.
- **Accessibility floor:** text meets WCAG AA (4.5:1 normal, 3:1 for large/bold ≥18.66px). Every control reachable and operable by keyboard.
- **No E2E tests.** Unit and integration only. Browser checks in Task 6 are manual verification, not a suite.
- **Existing behaviour is preserved** unless a step says otherwise.

## Deferred to Phase 3

Dark mode, full-text search, Markdown export, ⌘K palette, Goodreads CSV import, PWA, spaced repetition.

---

## File Structure

| File | Responsibility |
|---|---|
| `eslint.config.js` | Flat config: js + typescript-eslint + react-hooks + no-restricted-globals |
| `.prettierrc.json`, `.prettierignore` | Formatting |
| `.github/workflows/ci.yml` | typecheck · lint · test · build on push and PR |
| `src/app/AppShell.tsx` | Sidebar, mobile FAB, audio player, global dialogs, `<Outlet/>` |
| `src/app/routes.tsx` | Route table |
| `src/app/ErrorBoundary.tsx` | Route-level error boundary with recovery |
| `src/features/library/LibraryPage.tsx` | Library route (was the `view === 'library'` branch) |
| `src/features/book/BookDetailPage.tsx` | `/book/:id` route |
| `src/features/book/ReaderPage.tsx` | `/book/:id/read` route |
| `src/features/stats/StatsPage.tsx` | `/stats` route wrapper |
| `src/features/profile/ProfilePage.tsx` | `/profile` route wrapper |
| `src/features/library/RecommendationCarousel.tsx` | Carousel + keyboard nav, lifted out of App |
| `src/components/ui/Dialog.tsx` | Focus-trapping modal primitive |
| `src/components/ui/ConfirmDialog.tsx` | Promise-based confirm |
| `src/components/ui/Toast.tsx`, `src/components/ui/toastStore.ts` | Toast host + store |
| `src/features/book/useBookRoute.ts` | Loads book + summary for the `:id` param |

---

## Task 1: Lint, format, and CI

Comes first so every later task is checked by the same gate.

**Files:**
- Create: `eslint.config.js`, `.prettierrc.json`, `.prettierignore`, `.github/workflows/ci.yml`
- Modify: `package.json`

**Interfaces:**
- Consumes: nothing
- Produces: `npm run lint`, `npm run format`, `npm run format:check`

- [ ] **Step 1: Install the tooling**

```bash
npm install -D eslint@^10 @eslint/js typescript-eslint@^8 eslint-plugin-react-hooks@^7 globals prettier@^3
```

- [ ] **Step 2: Write `eslint.config.js`**

```js
import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'coverage'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    // lib/ must stay framework-free so it is testable without a DOM renderer.
    files: ['src/lib/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: ['react', 'react-dom', 'react/*'] }],
    },
  },
);
```

React-hooks preset shape differs between plugin majors. Add whichever of these
`npx eslint .` accepts, then keep it: `reactHooks.configs['recommended-latest']`
(v7 flat preset) or `reactHooks.configs.recommended`. If neither resolves, enable
the two rules directly: `'react-hooks/rules-of-hooks': 'error'`,
`'react-hooks/exhaustive-deps': 'warn'`.

- [ ] **Step 3: Write `.prettierrc.json` and `.prettierignore`**

```json
{
  "singleQuote": true,
  "printWidth": 100,
  "trailingComma": "all",
  "semi": true
}
```

`.prettierignore`:

```
dist
node_modules
package-lock.json
```

- [ ] **Step 4: Add the scripts**

In `package.json`:

```json
"lint": "eslint .",
"lint:fix": "eslint . --fix",
"format": "prettier --write .",
"format:check": "prettier --check ."
```

- [ ] **Step 5: Run lint and fix what it finds**

Run: `npm run lint`
Expected: failures in the untouched-since-import components (unused vars, `any`, missing type-only imports). Fix them — do not weaken rules to pass. `npm run lint:fix` handles the mechanical ones.

`@typescript-eslint/no-explicit-any` will flag the imported components. Replace each `any` with a real type; if a shape is genuinely unknown, use `unknown` and narrow at the use site.

- [ ] **Step 6: Format the codebase once**

```bash
npm run format
npm run typecheck && npm test
```

Expected: both green. This is a whitespace-only commit for most files.

- [ ] **Step 7: Write `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm run format:check
      - run: npm test
      - run: npm run build
```

Node 22 rather than 20: `jsdom@30` declares `^22.22.2 || ^24.15.0 || >=26`, and CI should not install against an engine the dependency disclaims.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "build: add ESLint, Prettier, and CI

Typecheck, lint, format check, tests and build now run on every push and PR."
```

---

## Task 2: Routing and page decomposition

**Files:**
- Create: `src/app/AppShell.tsx`, `src/app/routes.tsx`, `src/features/library/LibraryPage.tsx`, `src/features/library/RecommendationCarousel.tsx`, `src/features/book/BookDetailPage.tsx`, `src/features/book/ReaderPage.tsx`, `src/features/book/useBookRoute.ts`, `src/features/stats/StatsPage.tsx`, `src/features/profile/ProfilePage.tsx`
- Modify: `src/App.tsx` (becomes the router host), `src/main.tsx`
- Test: `src/app/routing.test.tsx`

**Interfaces:**
- Consumes: `useLibrary`, `useProfile`
- Produces: routes `/` (library), `/book/:id`, `/book/:id/read`, `/stats`, `/profile`; `useBookRoute(): { book, summary, isLoading, setSummary }`

- [ ] **Step 1: Install react-router**

```bash
npm install react-router@^8
```

- [ ] **Step 2: Write the failing routing test**

Create `src/app/routing.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import App from '../App';
import { ProfileProvider } from '../features/profile/ProfileContext';
import { resetDb } from '../lib/storage/db';
import { books, profiles } from '../lib/storage/repo';
import { ACTIVE_PROFILE_KEY } from '../features/profile/ProfileContext';

async function seedAndRender() {
  const profile = await profiles.create({ name: 'Dorian' });
  localStorage.setItem(ACTIVE_PROFILE_KEY, profile.id);
  const book = await books.create({
    profileId: profile.id,
    title: 'Atomic Habits',
    author: 'James Clear',
    category: 'Productivity',
    status: 'Finished',
    rating: 5,
    readingTimeMinutes: 12,
    coverImageUrl: '',
    hasPdf: false,
  });
  render(
    <ProfileProvider>
      <App />
    </ProfileProvider>,
  );
  return { profile, book };
}

beforeEach(async () => {
  await resetDb();
  localStorage.clear();
  window.history.pushState({}, '', '/');
});

describe('routing', () => {
  it('starts on the library route', async () => {
    await seedAndRender();
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: /your library/i })).toBeInTheDocument(),
    );
    expect(window.location.pathname).toBe('/');
  });

  it('navigates to a book and puts its id in the URL', async () => {
    const { book } = await seedAndRender();
    await waitFor(() => expect(screen.getByText('Atomic Habits')).toBeInTheDocument());

    await userEvent.click(screen.getByText('Atomic Habits'));

    await waitFor(() => expect(window.location.pathname).toBe(`/book/${book.id}`));
  });

  it('returns to the library when the browser back button is pressed', async () => {
    const { book } = await seedAndRender();
    await waitFor(() => expect(screen.getByText('Atomic Habits')).toBeInTheDocument());
    await userEvent.click(screen.getByText('Atomic Habits'));
    await waitFor(() => expect(window.location.pathname).toBe(`/book/${book.id}`));

    window.history.back();

    await waitFor(() => expect(window.location.pathname).toBe('/'));
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: /your library/i })).toBeInTheDocument(),
    );
  });

  it('renders the stats route directly from its URL', async () => {
    window.history.pushState({}, '', '/stats');
    await seedAndRender();
    await waitFor(() => expect(screen.getByText(/reading stats/i)).toBeInTheDocument());
  });

  it('redirects an unknown book id back to the library', async () => {
    window.history.pushState({}, '', '/book/does-not-exist');
    await seedAndRender();
    await waitFor(() => expect(window.location.pathname).toBe('/'));
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npm test -- src/app/routing.test.tsx`
Expected: FAIL — no router mounted, `window.location.pathname` never changes.

- [ ] **Step 4: Write `src/features/book/useBookRoute.ts`**

```ts
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useLibrary } from '../library/useLibrary';
import type { Book, Summary } from '../../types';

/** Resolves the :id route param to a book plus its summary. Redirects home if unknown. */
export function useBookRoute() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { books, isLoading: libraryLoading, getSummary } = useLibrary();
  const [summary, setSummary] = useState<Summary | undefined>(undefined);

  const book: Book | undefined = books.find((candidate) => candidate.id === id);

  useEffect(() => {
    if (libraryLoading) return;
    if (!book) {
      void navigate('/', { replace: true });
      return;
    }
    void getSummary(book.id).then(setSummary);
  }, [book, libraryLoading, getSummary, navigate]);

  return { book, summary, setSummary, isLoading: libraryLoading };
}
```

- [ ] **Step 5: Split the pages out of `App.tsx`**

Move each branch of the current `view === ...` ternary into its own component, changing only what routing requires:

- `LibraryPage.tsx` — the `view === 'library'` JSX, its filter state, `filteredBooks`, and the recommendations block. Navigation becomes `navigate(\`/book/\${book.id}\`)` instead of `setView('book-detail')`.
- `RecommendationCarousel.tsx` — the carousel markup plus `scrollRecommendations`, taking `{ recommendations, isRefreshing, onRefresh, onPreview, addingBookTitle }`.
- `BookDetailPage.tsx` — reads `useBookRoute()`, renders the existing `BookDetail` component.
- `ReaderPage.tsx` — reads `useBookRoute()`, renders `EReader`.
- `StatsPage.tsx` / `ProfilePage.tsx` — thin wrappers supplying props from the hooks.

`AppShell.tsx` keeps the sidebar, the mobile add button, the audio player, the daily wisdom modal, the key dialog, and renders `<Outlet />`. Sidebar buttons become `NavLink`s.

- [ ] **Step 6: Write `src/app/routes.tsx` and rewrite `App.tsx`**

```tsx
import { createBrowserRouter, RouterProvider } from 'react-router';
import { AppShell } from './AppShell';
import { ErrorBoundary } from './ErrorBoundary';
import { LibraryPage } from '../features/library/LibraryPage';
import { BookDetailPage } from '../features/book/BookDetailPage';
import { ReaderPage } from '../features/book/ReaderPage';
import { StatsPage } from '../features/stats/StatsPage';
import { ProfilePage } from '../features/profile/ProfilePage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    errorElement: <ErrorBoundary />,
    children: [
      { index: true, element: <LibraryPage /> },
      { path: 'book/:id', element: <BookDetailPage /> },
      { path: 'book/:id/read', element: <ReaderPage /> },
      { path: 'stats', element: <StatsPage /> },
      { path: 'profile', element: <ProfilePage /> },
    ],
  },
]);

export function AppRoutes() {
  return <RouterProvider router={router} />;
}
```

`App.tsx` shrinks to the loading gate, the profile gate, and `<AppRoutes />`.

- [ ] **Step 7: Run the tests**

Run: `npm test -- src/app/routing.test.tsx`
Expected: PASS, 5 tests. Then `npm test` — the Phase 1 smoke suite must still pass; update its selectors only if the DOM genuinely moved.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(routing): give every screen a URL and restore the back button

Replaces useState<ViewState> with react-router. App.tsx drops from ~640 lines
to a shell plus one page component per route."
```

---

## Task 3: Accessible dialog primitive

**Files:**
- Create: `src/components/ui/Dialog.tsx`, `src/components/ui/Dialog.test.tsx`
- Modify: `AddBookModal.tsx`, `ChatModal.tsx`, `QuizModal.tsx`, `DailyWisdomModal.tsx`, `ApiKeyDialog.tsx`

**Interfaces:**
- Produces: `<Dialog open title onClose labelledBy? size?>` rendering a focus-trapped modal

- [ ] **Step 1: Write the failing Dialog test**

Create `src/components/ui/Dialog.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Dialog } from './Dialog';

function Harness({ onClose = vi.fn() }: { onClose?: () => void }) {
  return (
    <>
      <button>outside</button>
      <Dialog open title="Add a book" onClose={onClose}>
        <button>first</button>
        <button>second</button>
      </Dialog>
    </>
  );
}

describe('Dialog', () => {
  it('exposes itself as a labelled modal', () => {
    render(<Harness />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName('Add a book');
  });

  it('moves focus into the dialog on open', async () => {
    render(<Harness />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'first' })).toHaveFocus());
  });

  it('closes on Escape', async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('traps Tab inside the dialog', async () => {
    render(<Harness />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'first' })).toHaveFocus());

    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'second' })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'first' })).toHaveFocus();
  });

  it('traps Shift+Tab backwards', async () => {
    render(<Harness />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'first' })).toHaveFocus());
    await userEvent.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
  });

  it('restores focus to the trigger on unmount', async () => {
    function Toggle() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>open</button>
          <Dialog open={open} title="T" onClose={() => setOpen(false)}>
            <button>inside</button>
          </Dialog>
        </>
      );
    }
    render(<Toggle />);
    const trigger = screen.getByRole('button', { name: 'open' });
    await userEvent.click(trigger);
    await waitFor(() => expect(screen.getByRole('button', { name: 'inside' })).toHaveFocus());

    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('closes when the backdrop is clicked', async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await userEvent.click(screen.getByTestId('dialog-backdrop'));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
```

Add `import { useState } from 'react';` at the top of the test file.

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- src/components/ui/Dialog.test.tsx`
Expected: FAIL — `Failed to resolve import "./Dialog"`.

- [ ] **Step 3: Write `src/components/ui/Dialog.tsx`**

```tsx
import { useCallback, useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface DialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Tailwind max-width class for the panel. */
  size?: string;
}

export function Dialog({ open, title, onClose, children, size = 'max-w-xl' }: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const titleId = useId();

  const focusable = useCallback(
    () => Array.from(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []),
    [],
  );

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    focusable()[0]?.focus();

    return () => {
      previouslyFocused.current?.focus();
    };
  }, [open, focusable]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const items = focusable();
      if (items.length === 0) return;

      const first = items[0]!;
      const last = items[items.length - 1]!;
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose, focusable]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div
        data-testid="dialog-backdrop"
        className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative w-full ${size} bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200`}
      >
        <div className="flex justify-between items-center gap-4 p-6 sm:px-8 sm:pt-8 sm:pb-4">
          <h2 id={titleId} className="text-2xl font-bold text-gray-900">
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        <div className="px-6 pb-6 sm:px-8 sm:pb-8 overflow-y-auto max-h-[75vh]">{children}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the tests**

Run: `npm test -- src/components/ui/Dialog.test.tsx`
Expected: PASS, 7 tests.

- [ ] **Step 5: Migrate the five modals**

For each of `AddBookModal`, `ChatModal`, `QuizModal`, `DailyWisdomModal`, `ApiKeyDialog`: delete its hand-rolled `fixed inset-0` wrapper, backdrop div, and header (title + close button), and wrap the remaining body in `<Dialog open title="…" onClose={onClose}>`. Keep every form field and handler as-is.

Titles: "Add New Insight", "Chat about this book", "Test yourself", "Today's wisdom", "Connect Gemini".

- [ ] **Step 6: Verify the suite and commit**

```bash
npm run typecheck && npm run lint && npm test
git add -A
git commit -m "feat(a11y): add a focus-trapping Dialog and migrate all five modals

Escape closes, Tab cycles inside the panel, focus returns to the trigger, and
each dialog is exposed as a labelled aria-modal."
```

---

## Task 4: Toasts, confirm dialog, error boundary

**Files:**
- Create: `src/components/ui/toastStore.ts`, `src/components/ui/Toast.tsx`, `src/components/ui/ConfirmDialog.tsx`, `src/components/ui/toastStore.test.ts`, `src/app/ErrorBoundary.tsx`
- Modify: `AppShell.tsx`, `LibraryPage.tsx`, `BookDetailPage.tsx`, `ProfileView.tsx`, `BookDetail.tsx`, `EReader.tsx`, `eslint.config.js`

**Interfaces:**
- Produces: `toast.error(msg)`, `toast.success(msg)`, `useToasts()`, `useConfirm(): (opts) => Promise<boolean>`

- [ ] **Step 1: Write the failing toast store test**

Create `src/components/ui/toastStore.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast, subscribeToToasts, getToasts, dismissToast, clearToasts } from './toastStore';

beforeEach(() => {
  clearToasts();
});

describe('toastStore', () => {
  it('adds a toast and notifies subscribers', () => {
    const listener = vi.fn();
    subscribeToToasts(listener);

    toast.error('Something broke');

    expect(getToasts()).toHaveLength(1);
    expect(getToasts()[0]).toMatchObject({ kind: 'error', message: 'Something broke' });
    expect(listener).toHaveBeenCalled();
  });

  it('gives each toast a distinct id', () => {
    toast.success('one');
    toast.success('two');
    const [a, b] = getToasts();
    expect(a!.id).not.toBe(b!.id);
  });

  it('dismisses by id', () => {
    toast.error('gone soon');
    dismissToast(getToasts()[0]!.id);
    expect(getToasts()).toHaveLength(0);
  });

  it('stops notifying after unsubscribe', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToToasts(listener);
    unsubscribe();
    toast.error('ignored');
    expect(listener).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- src/components/ui/toastStore.test.ts`
Expected: FAIL — `Failed to resolve import "./toastStore"`.

- [ ] **Step 3: Write `src/components/ui/toastStore.ts`**

```ts
export type ToastKind = 'error' | 'success' | 'info';

export interface ToastMessage {
  id: string;
  kind: ToastKind;
  message: string;
}

let toasts: ToastMessage[] = [];
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function push(kind: ToastKind, message: string) {
  toasts = [...toasts, { id: crypto.randomUUID(), kind, message }];
  emit();
}

export const toast = {
  error: (message: string) => push('error', message),
  success: (message: string) => push('success', message),
  info: (message: string) => push('info', message),
};

export const getToasts = (): ToastMessage[] => toasts;

export function dismissToast(id: string) {
  toasts = toasts.filter((item) => item.id !== id);
  emit();
}

export function clearToasts() {
  toasts = [];
  emit();
}

export function subscribeToToasts(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
```

- [ ] **Step 4: Write `Toast.tsx`**

A `ToastHost` component subscribing via `useSyncExternalStore(subscribeToToasts, getToasts)`, rendering a fixed bottom-right stack with `role="status"` and `aria-live="polite"` (`aria-live="assertive"` for errors), each with a dismiss button, auto-dismissing after 6s via `setTimeout` cleared on unmount.

- [ ] **Step 5: Write `ConfirmDialog.tsx`**

A `ConfirmProvider` holding pending-confirm state and exposing `useConfirm()` returning `(opts: { title: string; body: string; confirmLabel?: string; danger?: boolean }) => Promise<boolean>`. It renders a `<Dialog>` with cancel and confirm buttons and resolves the promise on either.

- [ ] **Step 6: Replace every `alert()` and `confirm()`**

Sites: `App.tsx`/`LibraryPage` recommendation-preview failure; `handleDeleteBook`; `handleResetLibrary`; `BookDetail` audio failure; `EReader` audio failure; `ProfileView` import validation, import confirmation, and read failure.

Each `alert(message)` becomes `toast.error(message)`. Each `confirm(question)` becomes `await confirm({ title, body, danger: true })`.

- [ ] **Step 7: Enforce it in ESLint**

Add to the main rules block in `eslint.config.js`:

```js
'no-restricted-globals': [
  'error',
  { name: 'alert', message: 'Use toast.error() from components/ui/toastStore.' },
  { name: 'confirm', message: 'Use useConfirm() from components/ui/ConfirmDialog.' },
],
```

- [ ] **Step 8: Write `src/app/ErrorBoundary.tsx`**

A `useRouteError()`-based component rendering the message plus a "Back to library" link and a "Reload" button.

- [ ] **Step 9: Verify and commit**

```bash
npm run typecheck && npm run lint && npm test
git add -A
git commit -m "feat(ux): replace alert/confirm with toasts and a confirm dialog

Adds a route-level error boundary and an ESLint rule so alert() and confirm()
cannot come back."
```

---

## Task 5: Contrast and keyboard access

**Files:**
- Modify: `src/index.css`, `RecommendationCarousel.tsx`, and every file using the failing orange utilities
- Test: `src/lib/contrast.test.ts`, `src/lib/contrast.ts`

**Interfaces:**
- Produces: `contrastRatio(hex, hex): number`

- [ ] **Step 1: Write the contrast helper and its test**

`src/lib/contrast.ts` implements WCAG relative luminance and `contrastRatio`. `src/lib/contrast.test.ts` asserts known values — black on white is 21, white on white is 1, and then the real assertion:

```ts
import { describe, expect, it } from 'vitest';
import { contrastRatio } from './contrast';

const PARCHMENT = '#fcfcf9';

describe('brand colours meet WCAG AA', () => {
  it('black on white is 21:1', () => {
    expect(Math.round(contrastRatio('#000000', '#ffffff'))).toBe(21);
  });

  it('the small-label orange passes AA for normal text', () => {
    // orange-700 (#c2410c) replaces orange-600 (#ea580c), which measured ~3.9:1
    expect(contrastRatio('#c2410c', PARCHMENT)).toBeGreaterThanOrEqual(4.5);
  });

  it('confirms the old orange-600 did not pass', () => {
    expect(contrastRatio('#ea580c', PARCHMENT)).toBeLessThan(4.5);
  });
});
```

- [ ] **Step 2: Swap the failing utilities**

Replace `text-orange-600` with `text-orange-700` on every **text** element (small uppercase labels, links, "Read Summary" affordances). Leave `bg-orange-600` alone — white on `#ea580c` is a background pairing, and the button text is large/bold.

Run: `grep -rn "text-orange-600" src/` and fix each hit.

- [ ] **Step 3: Make the carousel keyboard-operable**

In `RecommendationCarousel.tsx`: give the scroller `role="region"` and `aria-label="Recommended books"`, make each card a real `<button>` (it is currently a `div` with `onClick`), and add `group-focus-within:` variants everywhere `group-hover:` reveals the preview overlay so the information is reachable without a pointer.

- [ ] **Step 4: Verify and commit**

```bash
npm run typecheck && npm run lint && npm test
git add -A
git commit -m "fix(a11y): meet AA contrast and make the carousel keyboard-operable

text-orange-600 on the parchment background measured ~3.9:1. Recommendation
cards are buttons now, and the hover-only preview is reachable via focus."
```

---

## Task 6: Streaming chat and browser verification

**Files:**
- Modify: `src/lib/ai/chat.ts`, `src/components/ChatModal.tsx`

- [ ] **Step 1: Add a streaming send to `chat.ts`**

```ts
/** Streams a reply, calling onChunk with the text so far. Returns the full text. */
export async function sendMessageStream(
  chat: Chat,
  message: string,
  onChunk: (textSoFar: string) => void,
): Promise<string> {
  try {
    const stream = await chat.sendMessageStream({ message });
    let text = '';
    for await (const chunk of stream) {
      text += chunk.text ?? '';
      onChunk(text);
    }
    return text;
  } catch (error) {
    throw toAiError(error);
  }
}
```

- [ ] **Step 2: Use it in `ChatModal`**

Replace the awaited `sendMessage` with `sendMessageStream`, appending an empty assistant message first and updating its text on each chunk.

- [ ] **Step 3: Verify in a real browser**

```bash
npm run dev
```

Using Playwright MCP against the dev server, confirm and screenshot:

- [ ] Profile picker renders; creating a profile lands on `/`.
- [ ] Clicking a book changes the URL to `/book/:id`; browser back returns to `/` with the library intact.
- [ ] Tab reaches every sidebar item and the add button; focus rings are visible.
- [ ] Opening "Add Book" moves focus into the dialog; Escape closes it and returns focus to the trigger.
- [ ] With no key, submitting the add form opens the Connect Gemini dialog rather than failing silently.
- [ ] No console errors on any route.

- [ ] **Step 4: Final gate and commit**

```bash
npm run typecheck && npm run lint && npm run format:check && npm test && npm run build
grep -roE "AIza[0-9A-Za-z_-]{35}" dist/ ; echo "expect no matches"
git add -A
git commit -m "feat(chat): stream assistant replies token by token"
```

---

## Phase 2 Done When

- The browser back button works from every screen, and every screen has a shareable URL.
- All five dialogs trap focus, close on Escape, and restore focus to their trigger.
- No `alert()` or `confirm()` remains, and ESLint prevents their return.
- Text meets WCAG AA; the recommendation carousel is fully keyboard-operable.
- `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test` and `npm run build` all pass, and CI runs them on every push and PR.
- `App.tsx` is a shell; no single component file exceeds ~250 lines.

Next: Phase 3 (dark mode, search, Markdown export, ⌘K palette, Goodreads import, PWA, spaced repetition).
