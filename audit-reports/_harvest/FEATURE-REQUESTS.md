# Feature requests found by the audit — deliberately not built

These came out of the `feature-discovery` and `strategic-opportunities` lenses.
They are not defects: nothing here is broken, wrong, or lying to the user. Each
is a capability the codebase could support and does not.

They are recorded rather than implemented because building unrequested features
is out of scope for a fix pass. Good candidates for GitHub issues once the repo
is public — several are genuinely well-shaped starter tasks for a contributor.

## Substantial

| id | What | Why it is plausible |
|---|---|---|
| F014 | **Resume a chat conversation.** Chats are discarded on close. | The SDK's `chats.create` takes a `history` parameter that is never passed. Storing the transcript per book would be a small store and one prop. |
| F015 | **Chat across the whole library**, not just one book. | `prompts.ts` builds a per-book system prompt. A library-wide one would need a different context strategy — real design work, not a wiring change. |
| F012 | **Multi-select in the library grid** for bulk re-categorise / re-status / delete. | Especially wanted after a 300-book Goodreads import, where every book arrives with whatever shelf it had. |
| F010 | **A card source that is not an AI quiz.** The SM-2 scheduler is general, but the only way to fill the deck is `generateBookQuiz`. | So the review feature — the one that makes the app worth returning to — is unavailable without a key. Manual card creation would fix that. |

## Small

| id | What | Why it is plausible |
|---|---|---|
| F011 | **Filter or count unsummarised books.** `summaryId` is on every book and no view uses it. | After an import, "which of these have I actually summarised?" has no answer short of clicking each one. |
| F020 | **Surface `ease` / `intervalDays` / `reviewCount`.** Every grade writes all three and nothing ever reads them back. | A "next due in N days" line on a card, or a retention stat, would make the schedule legible instead of invisible. |
| F007 | **Preview-before-add.** `BookDetail` still contains a fully-built preview mode (`isPreview`, `onAdd`) that no caller can reach. | Removed from the flow in Phase 1. Either wire it back or delete the branch — right now it is dead weight that reads as a feature. |

## Partially addressed

| id | What | Where it stands |
|---|---|---|
| F017 | The free cover chain (Google Books → OpenLibrary → placeholder) was reachable only from AI code paths. | The manual add path now uses it. **Bulk Goodreads import deliberately does not**: it is one network request per book, so a 300-book import would fire 300. That path stays ISBN-URL-only, which is free and instant. Closing this fully means a background backfill queue — a feature, not a fix. |
| F006 | Every add path except the Goodreads tab required a key, contradicting the README. | **Fixed.** "Add without AI" on the search tab creates the book unsummarised, with a free cover, and the detail page's "Summarise this book" takes it from there. |
