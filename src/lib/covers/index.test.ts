import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearCoverCache, fetchCover } from './index';
import { placeholderCover } from './placeholder';
import { requestUrl } from '../../test/fetchSpy';

function mockFetch(handler: (url: string) => unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const result = handler(requestUrl(input));
      if (result === null) return new Response('', { status: 404 });
      return new Response(JSON.stringify(result), { status: 200 });
    }),
  );
}

beforeEach(() => {
  // The lookup cache is module-level, so without this each test would inherit
  // whatever the previous one resolved for the same title — and these tests
  // deliberately reuse "Atomic Habits" to exercise different provider outcomes.
  clearCoverCache();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchCover', () => {
  it('prefers Google Books and upgrades http to https', async () => {
    mockFetch((url) =>
      url.includes('googleapis.com')
        ? { items: [{ volumeInfo: { imageLinks: { large: 'http://books.test/large.jpg' } } }] }
        : null,
    );

    await expect(fetchCover('Atomic Habits', 'James Clear')).resolves.toBe(
      'https://books.test/large.jpg',
    );
  });

  it('falls back to OpenLibrary when Google Books has no cover', async () => {
    mockFetch((url) => {
      if (url.includes('googleapis.com')) return { items: [] };
      if (url.includes('openlibrary.org')) return { docs: [{ cover_i: 12345 }] };
      return null;
    });

    await expect(fetchCover('Deep Work', 'Cal Newport')).resolves.toBe(
      'https://covers.openlibrary.org/b/id/12345-L.jpg',
    );
  });

  it('falls back to a local placeholder when both APIs miss', async () => {
    mockFetch(() => ({ items: [], docs: [] }));

    const cover = await fetchCover('Nothing Found', 'Nobody');
    expect(cover).toBe(placeholderCover('Nothing Found'));
    expect(cover.startsWith('data:image/svg+xml,')).toBe(true);
  });

  it('falls back to the placeholder when the network throws', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))),
    );
    await expect(fetchCover('Offline', 'Nobody')).resolves.toBe(placeholderCover('Offline'));
  });

  it('contacts only the two free cover providers, never Gemini', async () => {
    const spy = vi.fn((input: RequestInfo | URL) => {
      void input;
      return new Response(JSON.stringify({ items: [], docs: [] }));
    });
    vi.stubGlobal('fetch', spy);

    await fetchCover('Anything', 'Anyone');

    // A positive allow-list, not a loop asserting no recorded call contained
    // 'generativelanguage'. That loop ran zero assertions whenever nothing was
    // fetched, and it would have waved through any other third-party or paid host.
    const hosts = [...new Set(spy.mock.calls.map((call) => new URL(requestUrl(call[0])).host))];
    expect(hosts.length).toBeGreaterThan(0);
    expect(hosts.sort()).toEqual(['openlibrary.org', 'www.googleapis.com']);
  });
});

/**
 * A miss costs two round trips and then returns a locally-generated placeholder,
 * and the same book is asked for by more than one surface — the recommendation
 * carousel and the add-book flow both resolve covers. Without a cache, every one
 * of those asks repeated both requests, including the ones already known to fail.
 */
describe('fetchCover caching', () => {
  it('asks the network once for a title it has already resolved', async () => {
    mockFetch((url) =>
      url.includes('googleapis.com')
        ? { items: [{ volumeInfo: { imageLinks: { large: 'https://books.test/a.jpg' } } }] }
        : null,
    );

    await fetchCover('Atomic Habits', 'James Clear');
    const afterFirst = vi.mocked(fetch).mock.calls.length;
    await fetchCover('Atomic Habits', 'James Clear');

    expect(vi.mocked(fetch).mock.calls.length).toBe(afterFirst);
  });

  it('caches a miss too, so a placeholder is not re-earned every time', async () => {
    mockFetch(() => null);

    await expect(fetchCover('Unknown Book', 'Nobody')).resolves.toBe(
      placeholderCover('Unknown Book'),
    );
    const afterFirst = vi.mocked(fetch).mock.calls.length;
    expect(afterFirst).toBeGreaterThan(0);

    await fetchCover('Unknown Book', 'Nobody');
    expect(vi.mocked(fetch).mock.calls.length).toBe(afterFirst);
  });

  it('collapses simultaneous asks for the same title into one set of calls', async () => {
    mockFetch((url) =>
      url.includes('googleapis.com')
        ? { items: [{ volumeInfo: { imageLinks: { large: 'https://books.test/b.jpg' } } }] }
        : null,
    );

    const results = await Promise.all([
      fetchCover('Deep Work', 'Cal Newport'),
      fetchCover('Deep Work', 'Cal Newport'),
      fetchCover('Deep Work', 'Cal Newport'),
    ]);

    expect(new Set(results).size).toBe(1);
    expect(vi.mocked(fetch).mock.calls.length).toBe(1);
  });

  it('treats casing and surrounding space as the same book', async () => {
    mockFetch((url) =>
      url.includes('googleapis.com')
        ? { items: [{ volumeInfo: { imageLinks: { large: 'https://books.test/c.jpg' } } }] }
        : null,
    );

    await fetchCover('Sapiens', 'Yuval Noah Harari');
    const afterFirst = vi.mocked(fetch).mock.calls.length;
    await fetchCover('  sapiens  ', 'YUVAL NOAH HARARI');

    expect(vi.mocked(fetch).mock.calls.length).toBe(afterFirst);
  });

  it('looks up a different title separately', async () => {
    mockFetch(() => null);

    await fetchCover('One Title', 'An Author');
    const afterFirst = vi.mocked(fetch).mock.calls.length;
    await fetchCover('Another Title', 'An Author');

    expect(vi.mocked(fetch).mock.calls.length).toBeGreaterThan(afterFirst);
  });
});

describe('placeholderCover', () => {
  it('uses up to two initials', () => {
    expect(decodeURIComponent(placeholderCover('Atomic Habits'))).toContain('>AH<');
    expect(decodeURIComponent(placeholderCover('Sapiens'))).toContain('>S<');
  });

  it('handles an empty title without throwing', () => {
    expect(decodeURIComponent(placeholderCover('   '))).toContain('>?<');
  });
});

/**
 * Both providers reached their values through `fetchJsonOrNull<T>`, which is an
 * assertion — it tells the compiler what to believe about a third party's JSON,
 * and nothing checks. Google Books' `imageLinks` was declared
 * `Record<string, string>`, so a number there hit `.replace` and threw;
 * OpenLibrary's `cover_i` was declared `number`, so a string interpolated
 * happily into the URL template and produced a plausible address that 404s.
 * Both were survivable only because something further out happened to catch —
 * an accidental guard, not an intended one.
 */
describe('cover providers against a response that is not what the type claims', () => {
  it('skips a Google Books link that is not a string', async () => {
    mockFetch((url) =>
      url.includes('googleapis.com')
        ? {
            items: [
              { volumeInfo: { imageLinks: { large: 42, thumbnail: { nested: 'object' } } } },
              { volumeInfo: { imageLinks: { large: 'https://books.test/real.jpg' } } },
            ],
          }
        : null,
    );

    // Falls through the junk to the entry that is genuinely a URL, rather than
    // throwing on the first one.
    await expect(fetchCover('Some Book', 'An Author')).resolves.toBe('https://books.test/real.jpg');
  });

  it('falls through to the placeholder when every Google link is junk', async () => {
    mockFetch((url) =>
      url.includes('googleapis.com')
        ? { items: [{ volumeInfo: { imageLinks: { large: 42 } } }] }
        : null,
    );

    await expect(fetchCover('Junk Only', 'An Author')).resolves.toBe(placeholderCover('Junk Only'));
  });

  it('ignores an OpenLibrary cover id that is not a positive integer', async () => {
    mockFetch((url) => (url.includes('openlibrary.org') ? { docs: [{ cover_i: '12345' }] } : null));

    await expect(fetchCover('String Id', 'An Author')).resolves.toBe(placeholderCover('String Id'));
  });

  it('ignores a negative OpenLibrary cover id', async () => {
    mockFetch((url) => (url.includes('openlibrary.org') ? { docs: [{ cover_i: -1 }] } : null));

    await expect(fetchCover('Negative Id', 'An Author')).resolves.toBe(
      placeholderCover('Negative Id'),
    );
  });

  it('survives a top-level shape that is not an object at all', async () => {
    mockFetch(() => 'not an object');

    await expect(fetchCover('Weird Response', 'An Author')).resolves.toBe(
      placeholderCover('Weird Response'),
    );
  });
});
