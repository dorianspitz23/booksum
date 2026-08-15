import { fetchJsonOrNull } from '../http';

interface SearchResponse {
  docs?: { cover_i?: number }[];
}

export async function fetchOpenLibraryCover(title: string, author: string): Promise<string | null> {
  const query = encodeURIComponent(`${title} ${author}`.trim());
  const data = await fetchJsonOrNull<SearchResponse>(
    `https://openlibrary.org/search.json?q=${query}&limit=1`,
  );

  const coverId = data?.docs?.[0]?.cover_i;
  return coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : null;
}
