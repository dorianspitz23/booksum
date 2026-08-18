## What this changes

<!-- One or two sentences. What is different after this lands? -->

## Why

<!--
For a bug fix: the specific input, and the wrong output it produced. "Fixes the stats page" is
harder to review than "importing an unrated Goodreads library dragged the average rating toward
0.0, because unrated books counted as zero rather than being excluded".

Link an issue if there is one.
-->

## How it was verified

<!--
Beyond "the tests pass". If you added a test, say how you know it can fail — breaking the code on
purpose and watching the right test go red is the check that matters here.
-->

## Checklist

- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] `npm run format:check` passes
- [ ] `npm test` passes, and reports **37 test files** or more (a lower count means workers failed to start)
- [ ] A bug fix comes with a test that fails without the fix
- [ ] No API key, personal data, or `.env` contents in the diff
- [ ] Non-obvious code explains _why_ in a comment
- [ ] The invariants in [CONTRIBUTING.md](https://github.com/dorianspitz23/booksum/blob/main/CONTRIBUTING.md) still hold

## Anything you are unsure about

<!-- Optional. Flagging a doubt is more useful than hiding it. -->
