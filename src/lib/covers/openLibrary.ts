export async function fetchOpenLibraryCover(title: string, author: string): Promise<string | null> {
  const query = encodeURIComponent(`${title} ${author}`.trim());
  const response = await fetch(`https://openlibrary.org/search.json?q=${query}&limit=1`);
  if (!response.ok) return null;

  const data = (await response.json()) as { docs?: { cover_i?: number }[] };
  const coverId = data.docs?.[0]?.cover_i;
  return coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : null;
}
