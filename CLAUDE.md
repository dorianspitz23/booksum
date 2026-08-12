# BookSum — Project Instructions

Local-first book summariser. React 19 + Vite 8 + TypeScript, IndexedDB for storage, Google Gemini
for AI. No server, no accounts, no backend.

## ⚠️ Current state — read before starting work

Phases 1–3 of the overhaul are **complete**. The next two steps, in order:

1. **A refactor pass — the user is doing this themselves in a dedicated session.**
   Do not start it unprompted. Scope and candidates:
   `docs/superpowers/plans/2026-08-12-booksum-refactor-handover.md`
2. **Phase 4 — open-source launch.** Agreed and scoped, blocked on the refactor landing.
   LICENSE (MIT), README screenshots, CONTRIBUTING, SECURITY, issue templates, public repo at
   `dorianspitz23/booksum`, GitHub Pages demo. The user reviews before anything is pushed.

History: `docs/superpowers/specs/` holds the design; `docs/superpowers/plans/` holds one plan per
phase. Commit `670b5fe` is the untouched Google AI Studio original, so any change is a diff
against it.

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
- **Every commit leaves `typecheck`, `lint`, `format:check` and `test` green.**

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
- Dark mode is a `.dark` class on `<html>`, applied by `useTheme()` in `AppShell`.
  `src/components/EReader.tsx` is deliberately excluded — it owns its own reader themes.
- `src/lib/contrast.ts` exists to assert colour choices meet WCAG AA. Use it when changing colours.

## Gotchas learned the hard way

- `fake-indexeddb` silently turns a stored `Blob` into `{}`. The repo stores `ArrayBuffer` + MIME
  type and converts at its boundary.
- A module-level `createBrowserRouter` keeps its own history and ignores the current URL on
  remount. It is built per mount in `src/app/routes.tsx`.
- Hooks that depend on the profile must wait for `useProfile().isLoading` to settle, or they will
  act on a null profile and silently drop the write.
- Never leave two `aria-modal` dialogs open at once — two focus traps fight each other.
