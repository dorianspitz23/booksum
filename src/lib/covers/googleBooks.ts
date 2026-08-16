import { fetchJsonOrNull } from '../http';

/**
 * What we hope to receive. `fetchJsonOrNull<T>` is an assertion, not a check —
 * it tells the compiler what to believe about a third party's JSON — so every
 * value taken from here is verified below rather than trusted from this shape.
 * `imageLinks` is deliberately `unknown`-valued to keep that honest.
 */
interface VolumesResponse {
  items?: { volumeInfo?: { imageLinks?: Record<string, unknown> } }[];
}

/** The link sizes Google Books offers, best first. */
const SIZES = ['extraLarge', 'large', 'medium', 'thumbnail', 'smallThumbnail'] as const;

export async function fetchGoogleBooksCover(title: string, author: string): Promise<string | null> {
  const queries = [
    `intitle:${title}${author ? ` inauthor:${author}` : ''}`,
    `${title} ${author}`.trim(),
  ];

  for (const query of queries) {
    const endpoint = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=3&printType=books`;
    // Timed out and null-on-failure. A bare fetch here had no timeout and its
    // rejection propagated, so one unreachable provider took the whole fallback
    // chain down instead of falling through to the next one.
    const data = await fetchJsonOrNull<VolumesResponse>(endpoint);
    if (!data || !Array.isArray(data.items)) continue;

    for (const item of data.items) {
      const links = item?.volumeInfo?.imageLinks;
      if (typeof links !== 'object' || links === null) continue;

      for (const size of SIZES) {
        const url = links[size];
        // Checked rather than assumed. The declared `Record<string, string>`
        // was a claim about someone else's API: a number or an object here
        // reached `.replace` and threw. `fetchCover` happened to catch it and
        // fall through, so the guard was accidental rather than intended.
        if (typeof url === 'string' && url.startsWith('http')) {
          return url.replace(/^http:\/\//, 'https://');
        }
      }
    }
  }

  return null;
}
