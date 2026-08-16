import type { Recommendation } from '../../lib/ai/recommend';

export const RECS_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Rebuilds cached recommendations field by field, discarding anything that is
 * not the shape this app writes, and returning null when nothing usable is left.
 *
 * The cache used to be `JSON.parse(raw) as { at: number; items: Recommendation[] }`
 * rendered straight into the carousel. localStorage is writable by anything
 * running on the origin and outlives every version of this app, so that cast was
 * a promise the data had no obligation to keep: an `items` of `"nope"` still
 * reached `.length`, and an entry whose `coverUrl` was an object still reached
 * an `<img src>`.
 */
export function parseCachedRecommendations(raw: string): Recommendation[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null) return null;
  const { at, items } = parsed as { at?: unknown; items?: unknown };

  if (typeof at !== 'number' || !Number.isFinite(at)) return null;
  if (Date.now() - at >= RECS_TTL_MS) return null;
  if (!Array.isArray(items)) return null;

  const clean = items.flatMap((item): Recommendation[] => {
    if (typeof item !== 'object' || item === null) return [];
    const { title, author, description, coverUrl } = item as Record<string, unknown>;
    // A recommendation with no title or author is not a book, whatever else it
    // carries. The two cosmetic fields degrade instead of disqualifying it.
    if (typeof title !== 'string' || typeof author !== 'string') return [];
    return [
      {
        title,
        author,
        description: typeof description === 'string' ? description : '',
        coverUrl: typeof coverUrl === 'string' ? coverUrl : '',
      },
    ];
  });

  return clean.length > 0 ? clean : null;
}

/** Shown before the user has generated their own. ISBN-based cover URLs are stable. */
export const RECOMMENDED_BOOKS: Recommendation[] = [
  {
    title: 'The Psychology of Money',
    author: 'Morgan Housel',
    description: "Timeless lessons on wealth, greed, and happiness. It's about how you behave.",
    coverUrl: 'https://covers.openlibrary.org/b/isbn/9780857197689-L.jpg',
  },
  {
    title: 'Deep Work',
    author: 'Cal Newport',
    description: 'Rules for focused success in a distracted world.',
    coverUrl: 'https://covers.openlibrary.org/b/isbn/9781455586691-L.jpg',
  },
  {
    title: 'Sapiens',
    author: 'Yuval Noah Harari',
    description: 'A brief history of humankind from the Stone Age to the Silicon Age.',
    coverUrl: 'https://covers.openlibrary.org/b/isbn/9780062316097-L.jpg',
  },
  {
    title: 'Essentialism',
    author: 'Greg McKeown',
    description: 'The disciplined pursuit of less. Getting the right things done.',
    coverUrl: 'https://covers.openlibrary.org/b/isbn/9780804137386-L.jpg',
  },
  {
    title: 'Thinking, Fast and Slow',
    author: 'Daniel Kahneman',
    description:
      'The two systems that drive the way we think. System 1 is fast, intuitive, and emotional.',
    coverUrl: 'https://covers.openlibrary.org/b/isbn/9780374275631-L.jpg',
  },
  {
    title: "Man's Search for Meaning",
    author: 'Viktor E. Frankl',
    description: "Psychiatrist Viktor Frankl's memoir has riveted generations of readers.",
    coverUrl: 'https://covers.openlibrary.org/b/isbn/9780807014271-L.jpg',
  },
];
