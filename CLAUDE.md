# BookSum — Project Instructions

Local-first book summariser. React 19 + Vite 8 + TypeScript, IndexedDB for storage, Google Gemini
for AI. No server, no accounts, no backend.

## Current state

All four phases are complete: foundation, quality, features, and a defect sweep that worked an
audit backlog of **441 findings** through to zero by severity. The project is published under MIT
at `dorianspitz23/booksum`, with a GitHub Pages demo built from `main`.

- `audit-reports/_harvest/PROGRESS.md` — what was done in each wave, and the traps hit along the
  way. Worth reading before a large change.
- `audit-reports/_harvest/live-findings.json` and `findings-session*.json` — the findings
  themselves, each with a file, a line and a stated mechanism.
- `node audit-reports/_harvest/closed.mjs` counts what is closed; `open.mjs <severity> <n>` lists
  what remains. A finding counts as closed only when **its id is named in a commit message**. If
  you reopen this workflow, keep naming ids or the counter drifts.
- `audit-reports/_harvest/FEATURE-REQUESTS.md` — findings that were feature requests rather than
  defects. Deliberately not built. Do not implement these without asking.

History: `docs/superpowers/specs/` holds the design; `docs/superpowers/plans/` holds one plan per
phase. Commit `670b5fe` is the untouched Google AI Studio original, so any change is a diff
against it.

### The audit worktrees are dead — do not wait on them

`git worktree list` may show ~30 worktrees under `.worktrees/` on `audit/*` and `apply/*` branches.
**None are running.** They are frozen copies of the repo at older commits, kept only because four of
them hold audit reports whose findings are **already harvested** into `_harvest/live-findings.json`.
Do not go re-reading the worktrees for findings.

Each is a full copy of the source, so any tool that walks the tree scans ~30 codebases unless told
not to. ESLint, Vitest and Prettier each ignore `.worktrees`. If a check suddenly reports hundreds
of problems in files you never touched, that exclusion is the first thing to check.

## Invariants — do not break these

- **No API key in the bundle.** `vite.config.ts` must contain no `define` for a key. The Gemini
  key is supplied by the user at runtime and lives in `localStorage`. Verify after any build:
  `grep -roE "AIza[0-9A-Za-z_-]{35}" dist/` must find nothing.
- **The app works with no key.** Library, notes, reading, import/export, stats, review and
  profiles must never require one. Only AI actions gate, and they open the key dialog.
- **Layering.** `src/lib/**` imports no React. `src/features/**` and `src/components/**` never
  import `idb` or `@google/genai` directly — they go through `src/lib/storage/repo.ts` and
  `src/lib/ai/*`. ESLint enforces the first half.
- **No binary data in records.** PDFs and audio are bytes in the `blobs` store, never base64 on a
  `Book`. This is what broke the original app.
- **No `alert()` or `confirm()`.** Use `toast` and `useConfirm()`. ESLint enforces it.
- **Goodreads import makes zero AI calls.** Importing a large library must stay free.
- **Model IDs live only in `src/lib/ai/models.ts`.**
- **Every commit leaves `typecheck`, `lint`, `format:check` and `test` green.** All four pass
  today; CI runs exactly these.

## Architecture

```
src/lib/         React-free: storage (IndexedDB), ai, covers, audio, srs, markdown, goodreads
src/features/    Feature folders: library, book, profile, review, settings, stats
src/components/  Shared UI; components/ui holds Dialog, ConfirmDialog, Toast, useFocusTrap
src/app/         Shell, routes, error boundary
```

`Book` and `Summary` are separate: a book can exist unsummarised, which is what makes Goodreads
import free. `readingTimeMinutes` and `oneSentenceTakeaway` are deliberately denormalised onto
`Book` so list views render without loading every summary.

## Conventions

- Tests live beside their subject (`foo.ts` → `foo.test.ts`). Unit + integration only; no E2E
  unless asked.
- Vitest runs with `pool: 'threads'` — the default `forks` pool cannot start workers on Windows
  when the path contains a space, as this one does.
- `testTimeout` is 20s and Testing Library's `asyncUtilTimeout` is 5s; IndexedDB round-trips
  overran the defaults under parallel load.
- Dark mode is a `.dark` class on `<html>`, applied by `useTheme()` in **`App`** — one level above
  the shell, so the loading screen and the profile picker honour it too. A small inline script in
  `index.html` reads the cached choice and sets the class before first paint; the stored theme
  lives in IndexedDB and arrives too late to prevent a white flash on its own.
  `src/components/EReader.tsx` is deliberately excluded — it owns its own reader themes.
- `src/lib/contrast.ts` exists to assert colour choices meet WCAG AA. Use it when changing colours.
- AI failures reach the user through an `onAiError` prop threaded down from
  `AppShell.handleAiError`, which is the only thing that opens the key dialog. Shared components in
  `src/components/` take it as a prop rather than calling `useShell()` — see `AddBookModal` and
  `ChatModal`. A bare `toast.error(toAiError(e).message)` leaves a keyless user with no way in.
- A backup file becomes typed data **only** through `parseLibraryExport`
  (`src/lib/storage/libraryExport.ts`), which rebuilds each record field by field so undeclared
  keys cannot reach IndexedDB. Never assert parsed JSON to `LibraryExport`.

## Gotchas learned the hard way

- `fake-indexeddb` silently turns a stored `Blob` into `{}`. The repo stores `ArrayBuffer` + MIME
  type and converts at its boundary.
- A module-level `createBrowserRouter` keeps its own history and ignores the current URL on
  remount. It is built per mount in `src/app/routes.tsx`.
- Hooks that depend on the profile must wait for `useProfile().isLoading` to settle, or they will
  act on a null profile and silently drop the write.
- Never leave two `aria-modal` dialogs open at once — two focus traps fight each other.
- Line endings are **LF everywhere**, enforced by `.gitattributes` (`* text=auto eol=lf`). Without
  it, a contributor whose git has `core.autocrlf=true` would rewrite every line of every file they
  touched. If you ever see a whole-file diff for a one-line edit, that is the cause — normalise
  before committing rather than landing an unreviewable diff.
- `vitest run` can fail to start worker threads under memory pressure, reporting **fewer test files
  than exist** plus N "errors". The tests that did run still pass, so a short run looks like a pass
  unless you check the count. There are **37 test files** — if the run reports fewer, it did not
  test what you think it did. Re-run before believing either a pass or a regression.
- A `useEffect` that registers a `window` listener has not run at the moment its component's output
  first appears in the DOM. A test that waits for the rendered text and then immediately fires a
  key can lose that key, and a synchronous assertion after it cannot retry — it fails only under
  load, which is when CI runs. Flush with `await act(async () => {})` before firing. Re-firing the
  key inside `waitFor` is the usual fix and is wrong in `ReviewPage`, where the same 1-4 keys grade
  once an answer is selected.
- jsdom has no `scrollIntoView`; `src/test/setup.ts` stubs it. Without that, any component that
  scrolls a transcript into view throws on mount and is untestable.
