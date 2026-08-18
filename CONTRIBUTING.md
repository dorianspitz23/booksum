# Contributing to BookSum

Thanks for considering it. This file covers what you need to know to make a change that lands.

## Getting set up

```bash
git clone https://github.com/dorianspitz23/booksum.git
cd booksum
npm install
npm run dev
```

You need **Node.js 22.22.2+, 24.15+, or 26+**. The gaps are deliberate: `jsdom`, which the tests run
on, disclaims the versions in between, so `npm install` warns and the test workers can misbehave.

You do **not** need a Gemini API key to work on most of the app. The library, reader, notes, stats,
import/export, review and profiles all work without one. You need a key only to exercise
summarising, audio, chat, quizzes and recommendations — and that spends your own money, so mock the
AI layer in tests rather than calling it.

## The four checks

Every commit must leave all four green. CI runs exactly these, so a red one will not merge.

```bash
npm run typecheck    # tsc --noEmit
npm run lint         # ESLint, type-aware
npm run format:check # Prettier in check mode
npm test             # Vitest
```

`npm run format` fixes formatting; `npm run lint:fix` fixes what ESLint can.

> Vitest can fail to **start** worker threads on a memory-constrained machine and then report fewer
> test files than exist. It exits non-zero, but the summary line still reads like a pass at a
> glance. There are **37 test files** — if a run reports fewer, close some things and run it again
> before concluding anything, in either direction.

## Invariants — please do not break these

These are load-bearing. Several were bugs before they were rules, and `CLAUDE.md` has the longer
version with the reasoning.

- **No API key in the bundle.** The key is supplied at runtime and lives in `localStorage`. CI fails
  if a key-shaped string reaches `dist/`.
- **The app works with no key.** Library, notes, reading, import/export, stats, review and profiles
  must never require one. AI actions gate, and open the key dialog.
- **Layering.** `src/lib/**` imports no React. `src/features/**` and `src/components/**` never
  import `idb` or `@google/genai` directly — they go through `src/lib/storage/repo.ts` and
  `src/lib/ai/*`. ESLint enforces the first half.
- **No binary data on records.** PDFs and audio are bytes in the `blobs` store, never base64 on a
  `Book`. Inline binary is what broke the app this was rebuilt from.
- **No `alert()` or `confirm()`.** Use `toast` and `useConfirm()`. ESLint enforces it.
- **Goodreads import makes zero AI calls.** Importing a large library must stay free, and a test
  guards it.
- **Model IDs live only in `src/lib/ai/models.ts`.**
- **Never trust model output.** Anything returned by Gemini is validated before it is stored. A
  quiz whose correct-answer index falls outside its own options used to jam the review deck
  permanently.

## Tests

Unit and integration tests, no E2E. Tests live beside their subject: `foo.ts` → `foo.test.ts`.

Two things this project cares about more than test count:

**A test must be able to fail.** Several tests here once could not. Three separate "this makes no AI
call" tests looped over recorded network calls asserting none hit Gemini — and zero calls means zero
assertions, so they passed without checking anything. If you add a test that passes first try,
consider breaking the code on purpose to confirm the right test fails.

**Assert the behaviour, not the shape.** Prefer accessible queries (`getByRole`, `getByLabelText`)
over class names and DOM structure.

## Pull requests

- **One concern per PR.** A bug fix and a refactor in the same diff is two PRs.
- **Say what breaks without the change.** "Fixes X" is less useful than the specific input and the
  wrong output it produced.
- **Add a test for a bug fix.** If the bug was reachable, a test can reach it.
- **Explain non-obvious code in the code.** This codebase comments _why_, not _what_ — especially
  where something looks wrong but is deliberate.
- Keep commits focused, with a message that says what changed and why.

## Reporting bugs

Open an issue using the bug report template. The single most useful thing you can include is the
exact sequence of steps, because everything is local — there are no server logs to check.

Please **do not** paste your API key into an issue. If you already have, revoke it in
[Google AI Studio](https://aistudio.google.com/apikey) first.

## Ideas and features

Feature requests are welcome via the feature request template. There is also a standing list of
requests that came out of the audit and were deliberately not built, in
`audit-reports/_harvest/FEATURE-REQUESTS.md` — worth a look before proposing something, since it may
already be there with notes on why.

## Security

Please do not open a public issue for a security problem. [SECURITY.md](SECURITY.md) explains what
to do instead, and what does and does not count as one for an app with no server.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
