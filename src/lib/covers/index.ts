import { fetchGoogleBooksCover } from './googleBooks';
import { fetchOpenLibraryCover } from './openLibrary';
import { placeholderCover } from './placeholder';

export { placeholderCover };

/**
 * Free sources first, then a locally generated placeholder.
 * Deliberately makes no Gemini call — the old image-model search step cost a
 * request per cover and regexed a URL out of prose.
 */
export async function fetchCover(title: string, author: string): Promise<string> {
  for (const lookup of [fetchGoogleBooksCover, fetchOpenLibraryCover]) {
    try {
      const url = await lookup(title, author);
      if (url) return url;
    } catch {
      // Fall through to the next source.
    }
  }
  return placeholderCover(title);
}
