import { fetchGoogleBooksCover } from './googleBooks';
import { fetchOpenLibraryCover } from './openLibrary';
import { placeholderCover } from './placeholder';

export { placeholderCover };

/**
 * In-flight and completed lookups, keyed on title + author.
 *
 * Each lookup costs up to two network round trips, and the same book gets asked
 * for more than once in normal use — the recommendation carousel and the
 * add-book flow both resolve covers, and a lookup that fell all the way through
 * to the placeholder repeated both requests every single time. Promises are
 * cached rather than results, so ten simultaneous asks for one title make one
 * set of calls instead of ten.
 *
 * Deliberately per-session and unbounded: a session's distinct titles are a few
 * dozen short strings, and a cover URL that goes stale should be re-fetched on
 * the next visit rather than pinned in storage.
 */
const lookups = new Map<string, Promise<string>>();

const cacheKey = (title: string, author: string) =>
  `${title.trim().toLowerCase()}|${author.trim().toLowerCase()}`;

/**
 * Free sources first, then a locally generated placeholder.
 * Deliberately makes no Gemini call — the old image-model search step cost a
 * request per cover and regexed a URL out of prose.
 */
export function fetchCover(title: string, author: string): Promise<string> {
  const key = cacheKey(title, author);
  const cached = lookups.get(key);
  if (cached) return cached;

  const pending = (async () => {
    for (const source of [fetchGoogleBooksCover, fetchOpenLibraryCover]) {
      try {
        const url = await source(title, author);
        if (url) return url;
      } catch {
        // Fall through to the next source.
      }
    }
    return placeholderCover(title);
  })();

  lookups.set(key, pending);
  return pending;
}

/** Test seam. Nothing in the app calls this; a reload is the real reset. */
export function clearCoverCache() {
  lookups.clear();
}
