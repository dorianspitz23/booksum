/**
 * @vitest-environment node
 *
 * Pure parsing; no DOM needed.
 */
import { describe, expect, it } from 'vitest';
import { parseCachedRecommendations, RECS_TTL_MS } from './recommendationDefaults';

const now = () => Date.now();

const wrap = (items: unknown, at = now()) => JSON.stringify({ at, items });

const valid = [
  { title: 'Deep Work', author: 'Cal Newport', description: 'Focus.', coverUrl: 'https://x/1.jpg' },
];

describe('parseCachedRecommendations', () => {
  it('accepts a cache this app wrote', () => {
    expect(parseCachedRecommendations(wrap(valid))).toEqual(valid);
  });

  it('rejects a cache past its 24-hour life', () => {
    expect(parseCachedRecommendations(wrap(valid, now() - RECS_TTL_MS - 1))).toBeNull();
  });

  /**
   * The reason this function exists. The value came back as
   * `JSON.parse(raw) as { at: number; items: Recommendation[] }` and went
   * straight into the carousel. localStorage is writable by anything on the
   * origin and outlives every version of this app, so each of these shapes was
   * previously rendered as though it were a list of books.
   */
  it.each([
    ['not JSON at all', 'not json {'],
    ['a bare string', JSON.stringify('nope')],
    ['null', JSON.stringify(null)],
    ['an array at the top level', JSON.stringify([1, 2, 3])],
    ['no timestamp', JSON.stringify({ items: valid })],
    ['a timestamp that is not a number', JSON.stringify({ at: 'yesterday', items: valid })],
    ['items that are not an array', wrap('nope')],
    ['items that are an empty array', wrap([])],
    ['entries that are not objects', wrap(['a string', 42, null])],
    ['entries with no title', wrap([{ author: 'Someone' }])],
    ['entries with a non-string title', wrap([{ title: { evil: true }, author: 'Someone' }])],
  ])('rejects %s', (_label, raw) => {
    expect(parseCachedRecommendations(raw)).toBeNull();
  });

  it('drops the bad entries and keeps the good ones', () => {
    const parsed = parseCachedRecommendations(wrap([...valid, { title: 'No author' }, null]));
    expect(parsed).toEqual(valid);
  });

  /**
   * Title and author identify the book, so an entry without them is not a
   * recommendation at all. Description and cover are cosmetic — losing a cover
   * should degrade to the placeholder, not discard a real suggestion.
   */
  it('keeps an entry whose cosmetic fields are the wrong type, with them blanked', () => {
    const parsed = parseCachedRecommendations(
      wrap([{ title: 'Deep Work', author: 'Cal Newport', description: 12, coverUrl: {} }]),
    );
    expect(parsed).toEqual([
      { title: 'Deep Work', author: 'Cal Newport', description: '', coverUrl: '' },
    ]);
  });
});
