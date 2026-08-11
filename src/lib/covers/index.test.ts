import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchCover } from './index';
import { placeholderCover } from './placeholder';

function mockFetch(handler: (url: string) => unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const result = handler(String(input));
      if (result === null) return new Response('', { status: 404 });
      return new Response(JSON.stringify(result), { status: 200 });
    }),
  );
}

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
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    await expect(fetchCover('Offline', 'Nobody')).resolves.toBe(placeholderCover('Offline'));
  });

  it('never calls a Gemini endpoint', async () => {
    const spy = vi.fn(async (input: RequestInfo | URL) => {
      void input;
      return new Response(JSON.stringify({ items: [], docs: [] }));
    });
    vi.stubGlobal('fetch', spy);

    await fetchCover('Anything', 'Anyone');

    for (const call of spy.mock.calls) {
      expect(String(call[0])).not.toContain('generativelanguage');
    }
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
