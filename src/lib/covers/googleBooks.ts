import { fetchJsonOrNull } from '../http';

interface VolumesResponse {
  items?: { volumeInfo?: { imageLinks?: Record<string, string> } }[];
}

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
    if (!data) continue;

    for (const item of data.items ?? []) {
      const links = item.volumeInfo?.imageLinks;
      const url =
        links?.extraLarge ??
        links?.large ??
        links?.medium ??
        links?.thumbnail ??
        links?.smallThumbnail;
      if (url) return url.replace(/^http:\/\//, 'https://');
    }
  }

  return null;
}
