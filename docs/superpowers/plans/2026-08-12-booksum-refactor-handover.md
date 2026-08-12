# Refactor Handover

**Status:** Not started. The user has since decided the assistant should do it rather than
handling it themselves — confirm the approach before starting.

**Context:** Phases 1–3 are complete and verified on a clean clone (153 tests, lint and build
green). Phase 4, the open-source launch, is agreed and waits on this refactor landing.

This is a list of what is actually untidy and why, written while it was still fresh. It is not a
plan — the shape of the refactor is the user's call.

## The core problem

Six components still carry their original Google AI Studio structure. Phases 1–3 changed what they
_do_ — new data model, new AI layer, dark mode, review cards — but never restructured them. Each
mixes data fetching, several dialogs, and a lot of markup in one file.

| File                              | Lines | Notes                                                                                                                                                   |
| --------------------------------- | ----: | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/BookDetail.tsx`   |   539 | The worst. Audio, deep dive, PDF opening, notes editing, rating, priority, chat and quiz mounting, and export all in one component.                     |
| `src/components/EReader.tsx`      |   477 | Owns its own light/sepia/dark theming, pagination and audio. Excluded from the app-wide dark mode on purpose — reconciling the two is a judgement call. |
| `src/components/ProfileView.tsx`  |   439 | Stats, editing, theme toggle, JSON export, Markdown export, CSV-free import, danger zone.                                                               |
| `src/components/AddBookModal.tsx` |   285 | Three modes (search, PDF, Goodreads) share one form and one submit handler.                                                                             |
| `src/components/AudioPlayer.tsx`  |   264 | Self-contained; lowest priority.                                                                                                                        |
| `src/components/QuizModal.tsx`    |   254 | Grew when review-card creation was added; that side effect arguably belongs in a hook.                                                                  |

Everything else is under 250 lines. `App.tsx` is 38.

## Specific things worth fixing

- **Dead props.** `BookDetailProps.isPreview` and `onAdd` are optional and no caller passes them
  any more — the recommendation flow now adds the book directly. The preview-only branches in the
  JSX are unreachable. Either delete them or restore a real preview flow (see the behaviour note
  below).
- **Two non-null assertions.** `src/components/BookDetail.tsx:534` and `:536` pass `summary!` to
  `ChatModal` and `QuizModal`. It is true at runtime — both buttons are only reachable once a
  summary exists — but the type system is being told, not shown. A guard or a narrowed wrapper
  would remove the lie.
- **Review-card creation lives inside `QuizModal`'s load effect.** It works and is tested, but a
  modal writing to the review store as a side effect of rendering is a surprising place for it.
- **`ProfileView` takes seven props** and does five unrelated jobs. It is the clearest candidate
  for splitting into sections.
- **`AddBookModal`'s submit handler** branches on `mode` for search vs PDF while the Goodreads mode
  bypasses the form entirely. The three modes want to be three components.

## Behaviour change to decide on

Clicking a recommended book used to open a **preview** you could then add to your library. Since
Phase 1 it adds the book immediately and opens it. The old flow added it on click-through anyway,
so little was lost, but if a true preview is wanted this refactor is the moment — it needs a way to
hold a summary for a book that has no record yet.

## Constraints while refactoring

Everything in `CLAUDE.md` under **Invariants** still applies. In particular:

- `src/lib/**` stays React-free; components never import `idb` or `@google/genai`.
- No `alert()`/`confirm()`; ESLint will reject them.
- Keep the suite green — `npm run typecheck && npm run lint && npm run format:check && npm test`.
- 153 tests exist and are the safety net for this work. Prefer moving code with tests intact over
  rewriting behaviour.

## After the refactor

Phase 4, already agreed with the user:

1. MIT `LICENSE`
2. README screenshots and a feature walkthrough
3. `CONTRIBUTING.md`, `SECURITY.md`, issue templates
4. Final secret scan of the whole history:
   `git log -p | grep -iE "AIza|api[_-]?key"`
5. `gh repo create dorianspitz23/booksum --public --source=. --remote=origin --push`
6. Repo topics, then GitHub → Settings → Pages → Source: GitHub Actions
   (**the user must click this one**; also set Vite `base: '/booksum/'` for a project page)

The user reviews everything before the push.
