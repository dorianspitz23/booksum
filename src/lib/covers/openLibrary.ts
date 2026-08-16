import { fetchJsonOrNull } from '../http';

/**
 * `fetchJsonOrNull<T>` asserts rather than validates, so `cover_i` is declared
 * `unknown` here and checked below. Typed as `number` it was a claim about
 * someone else's API: a string or an object still interpolated into the URL
 * template, producing a plausible-looking address that 404s. `BookCover`'s
 * onError caught the result, so the failure was invisible rather than absent.
 */
interface SearchResponse {
  docs?: { cover_i?: unknown }[];
}

export async function fetchOpenLibraryCover(title: string, author: string): Promise<string | null> {
  const query = encodeURIComponent(`${title} ${author}`.trim());
  const data = await fetchJsonOrNull<SearchResponse>(
    `https://openlibrary.org/search.json?q=${query}&limit=1`,
  );

  if (!data || !Array.isArray(data.docs)) return null;

  const coverId = data.docs[0]?.cover_i;
  if (typeof coverId !== 'number' || !Number.isInteger(coverId) || coverId <= 0) return null;

  return `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`;
}
