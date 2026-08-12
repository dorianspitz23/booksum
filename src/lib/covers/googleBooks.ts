export async function fetchGoogleBooksCover(title: string, author: string): Promise<string | null> {
  const queries = [
    `intitle:${title}${author ? ` inauthor:${author}` : ''}`,
    `${title} ${author}`.trim(),
  ];

  for (const query of queries) {
    const endpoint = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=3&printType=books`;
    const response = await fetch(endpoint);
    if (!response.ok) continue;

    const data = (await response.json()) as {
      items?: { volumeInfo?: { imageLinks?: Record<string, string> } }[];
    };

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
