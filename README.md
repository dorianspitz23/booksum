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

Without a key you can still use your library, notes, reading view, stats, import/export and
profiles. Only the AI features — summarising, audio, chat, quizzes and recommendations — need one.

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
src/lib/        React-free modules: storage (IndexedDB), AI, covers, audio
src/features/   React feature folders: profile, library, settings
src/components/ Shared UI
```

`src/lib` never imports React. `src/features` and `src/components` never import `idb` or
`@google/genai` directly — they go through `src/lib/storage/repo.ts` and `src/lib/ai/*`.

Books, summaries and profiles live in IndexedDB. PDFs and generated audio are stored as bytes in
a separate object store, so a large upload cannot break persistence. Model IDs live in exactly one
file, `src/lib/ai/models.ts`.

Profiles are local and have no passwords — they exist so several people sharing a browser can keep
separate libraries, not to provide security.

## Status

Phase 1 of a planned overhaul is complete: the project builds, stores data in IndexedDB, and asks
each user for their own Gemini key. Still to come are routing and accessible dialogs (Phase 2),
dark mode, full-text search, Goodreads import, an offline PWA and spaced-repetition review
(Phase 3). See `docs/superpowers/` for the design and plans.
