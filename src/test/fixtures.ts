import { books, profiles } from '../lib/storage/repo';
import type { Book } from '../types';

/**
 * The one book every suite reaches for.
 *
 * `repo.test.ts` and `narration.test.ts` each declared this field-for-field
 * identically, which meant adding a required field to `Book` broke them in two
 * places and — worse — let them drift into testing two subtly different books
 * while both claiming to test "a book".
 *
 * Deliberately *not* a shared `beforeEach`: each suite still calls `resetDb()`
 * itself. Isolation stated in the file that depends on it is worth the one
 * repeated line; a suite that silently inherits its own reset from somewhere
 * else is the kind of thing that makes a failure impossible to localise.
 */
export function bookInput(
  profileId: string,
  overrides: Partial<Parameters<typeof books.create>[0]> = {},
) {
  return {
    profileId,
    title: 'Atomic Habits',
    author: 'James Clear',
    category: 'Productivity',
    status: 'Finished' as const,
    rating: 5,
    readingTimeMinutes: 12,
    coverImageUrl: 'https://example.test/cover.jpg',
    hasPdf: false,
    ...overrides,
  };
}

/** A profile and a book belonging to it, persisted — the usual starting point. */
export async function seedBook(
  overrides: Partial<Parameters<typeof books.create>[0]> = {},
): Promise<Book> {
  const profile = await profiles.create({ name: 'Dorian' });
  return books.create(bookInput(profile.id, overrides));
}
