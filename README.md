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
| `npm run lint`       | ESLint                           |
| `npm run format`     | Prettier, writing in place       |
| `npm test`           | Run the test suite once          |
| `npm run test:watch` | Run tests in watch mode          |

CI runs typecheck, lint, format check, tests and build on every push and pull request.

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

## Features

- **AI summaries** of any book by title, or from an uploaded PDF
- **Narrated audio** in your choice of voice
- **Chat** with a book, and **quizzes** that test comprehension
- **Spaced-repetition review** — quiz questions become cards on an SM-2-style schedule
- **Goodreads import** from the official CSV export, with no AI cost
- **Markdown export** of a single book or the whole library
- **Dark mode**, following your system by default
- **Local profiles** so several readers can share a browser

## Status

Phases 1–3 of a planned overhaul are complete. Remaining: open-source packaging — LICENSE,
screenshots, contributing guide and a hosted demo. See `docs/superpowers/` for the design and
plans.
