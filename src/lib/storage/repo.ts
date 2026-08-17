import type { IDBPTransaction } from 'idb';
import { getDb } from './db';
import type { BookSumDB } from './db';
import { newId } from '../id';
import type { BlobKind, Book, Profile, ReviewCard, Summary } from '../../types';

/**
 * One rule about deletion, stated once so the modules below cannot drift apart:
 *
 * **Deleting cascades downwards, and only `profiles` and `books` delete.**
 * `books.remove` takes the book's summaries, blobs and review cards with it;
 * `profiles.remove` does that for every book it owns. The child modules
 * (`summaries`, `blobs`, `reviewCards`) deliberately expose no delete-by-book
 * of their own.
 *
 * Each of them used to carry a `removeByBook`, none of which had a single
 * caller: the real cascade is `removeBookWithin`, which does the deletes inside
 * the caller's transaction. Keeping unused parallel paths around is how a
 * cascade quietly acquires a second, non-atomic version of itself.
 */

export const profiles = {
  /**
   * Sorted defensively. `a.createdAt.localeCompare(...)` called a string method
   * on a value the schema declares but nothing enforces: a profile row written
   * by an older build without `createdAt` threw here, and this is the first read
   * of the session, so the failure was the picker never rendering at all — no
   * profiles, no way in, no error the user could act on. Coercing instead sorts
   * an undated profile first and lets the app start.
   */
  async list(): Promise<Profile[]> {
    const all = await (await getDb()).getAll('profiles');
    return all.sort((a, b) => String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? '')));
  },

  async get(id: string): Promise<Profile | undefined> {
    return (await getDb()).get('profiles', id);
  },

  async create(input: { name: string } & Partial<Omit<Profile, 'id' | 'name'>>): Promise<Profile> {
    const profile: Profile = {
      id: newId(),
      name: input.name.trim(),
      bio: input.bio ?? 'Passionate about distilling wisdom and applying it to daily life.',
      monthlyGoal: input.monthlyGoal ?? 4,
      favoriteVoice: input.favoriteVoice ?? 'Kore',
      theme: input.theme ?? 'system',
      createdAt: input.createdAt ?? new Date().toISOString(),
    };
    await (await getDb()).put('profiles', profile);
    return profile;
  },

  async update(profile: Profile): Promise<Profile> {
    await (await getDb()).put('profiles', profile);
    return profile;
  },

  /**
   * One transaction across every store. This used to delete each book in its own
   * set of transactions and then the profile in another, so a failure part-way
   * through left the profile gone and its books orphaned under a profileId that
   * no longer existed — unreachable rows that nothing would ever collect.
   */
  async remove(id: string): Promise<void> {
    const db = await getDb();
    const tx = db.transaction(CASCADE_STORES, 'readwrite');

    const bookIds = await tx.objectStore('books').index('by-profile').getAllKeys(id);
    for (const bookId of bookIds) {
      await removeBookWithin(tx, bookId);
    }
    await tx.objectStore('profiles').delete(id);

    await tx.done;
  },
};

/**
 * Both cascades open a transaction over the same five stores so they can share
 * one implementation. Deleting a single book also locks `profiles` briefly,
 * which costs nothing here and keeps the helper concretely typed rather than
 * generic over store tuples.
 */
const CASCADE_STORES = ['profiles', 'books', 'summaries', 'blobs', 'reviewCards'] as const;
type CascadeTx = IDBPTransaction<BookSumDB, typeof CASCADE_STORES, 'readwrite'>;

/**
 * Deletes a book and everything that hangs off it, inside a transaction the
 * caller owns — so removing one book and removing a whole profile share the same
 * cascade and the same all-or-nothing guarantee.
 */
async function removeBookWithin(tx: CascadeTx, bookId: string): Promise<void> {
  const summaryStore = tx.objectStore('summaries');
  const blobStore = tx.objectStore('blobs');
  const cardStore = tx.objectStore('reviewCards');

  const summaryKeys = await summaryStore.index('by-book').getAllKeys(bookId);
  const blobKeys = await blobStore.index('by-book').getAllKeys(bookId);
  const cardKeys = await cardStore.index('by-book').getAllKeys(bookId);

  for (const key of summaryKeys) await summaryStore.delete(key);
  for (const key of blobKeys) await blobStore.delete(key);
  for (const key of cardKeys) await cardStore.delete(key);
  await tx.objectStore('books').delete(bookId);
}

export const books = {
  async listByProfile(profileId: string): Promise<Book[]> {
    return (await getDb()).getAllFromIndex('books', 'by-profile', profileId);
  },

  async get(id: string): Promise<Book | undefined> {
    return (await getDb()).get('books', id);
  },

  async create(
    input: Omit<Book, 'id' | 'addedAt'> & Partial<Pick<Book, 'id' | 'addedAt'>>,
  ): Promise<Book> {
    const book: Book = {
      ...input,
      id: input.id ?? newId(),
      addedAt: input.addedAt ?? new Date().toISOString(),
    };
    await (await getDb()).put('books', book);
    return book;
  },

  async update(book: Book): Promise<Book> {
    await (await getDb()).put('books', book);
    return book;
  },

  /**
   * One transaction. This used to span four independent ones, so a failure
   * midway left orphaned summaries, blobs or review cards behind — and because
   * it looked up the summary with getByBook (singular), a book carrying more
   * than one summary row only ever had the first deleted.
   */
  async remove(id: string): Promise<void> {
    const db = await getDb();
    const tx = db.transaction(CASCADE_STORES, 'readwrite');
    await removeBookWithin(tx, id);
    await tx.done;
  },

  /**
   * Empties a profile's library in one transaction, keeping the profile itself.
   * Removing books one at a time meant one full cascade and one library reload
   * per book — 300 concurrent reads of a shrinking library for a 300-book
   * import, with no atomicity if any of them failed.
   */
  async removeAllForProfile(profileId: string): Promise<number> {
    const db = await getDb();
    const tx = db.transaction(CASCADE_STORES, 'readwrite');

    const bookIds = await tx.objectStore('books').index('by-profile').getAllKeys(profileId);
    for (const bookId of bookIds) {
      await removeBookWithin(tx, bookId);
    }

    await tx.done;
    return bookIds.length;
  },
};

export const reviewCards = {
  /** Index-backed: this used to read every card of every profile and filter in memory. */
  async listByProfile(profileId: string): Promise<ReviewCard[]> {
    return (await getDb()).getAllFromIndex(
      'reviewCards',
      'by-profile-due',
      IDBKeyRange.bound([profileId, ''], [profileId, '￿']),
    );
  },

  /**
   * ISO timestamps sort chronologically, so the compound [profileId, dueAt]
   * index can answer "due now" as a single bounded range rather than a scan.
   */
  async listDue(profileId: string, now: Date = new Date()): Promise<ReviewCard[]> {
    const cutoff = now.toISOString();
    return (await getDb()).getAllFromIndex(
      'reviewCards',
      'by-profile-due',
      IDBKeyRange.bound([profileId, ''], [profileId, cutoff]),
    );
  },

  async listByBook(bookId: string): Promise<ReviewCard[]> {
    return (await getDb()).getAllFromIndex('reviewCards', 'by-book', bookId);
  },

  /**
   * `dueAt` is normalised on the way in. The `by-profile-due` index is ordered on
   * it, so a value that is not an ISO timestamp sorts past every real cutoff and
   * makes the card permanently unreachable through listDue. Falling back to "now"
   * makes a malformed card due immediately, which is the recoverable failure:
   * the user sees it, grades it, and the next write is well-formed.
   */
  async upsert(card: ReviewCard): Promise<ReviewCard> {
    const parsed = Date.parse(card.dueAt);
    const normalised: ReviewCard = {
      ...card,
      dueAt: new Date(Number.isNaN(parsed) ? Date.now() : parsed).toISOString(),
    };

    await (await getDb()).put('reviewCards', normalised);
    return normalised;
  },
};

export const summaries = {
  async getByBook(bookId: string): Promise<Summary | undefined> {
    return (await getDb()).getFromIndex('summaries', 'by-book', bookId);
  },

  async listByBook(bookId: string): Promise<Summary[]> {
    return (await getDb()).getAllFromIndex('summaries', 'by-book', bookId);
  },

  async upsert(summary: Summary): Promise<Summary> {
    await (await getDb()).put('summaries', summary);
    return summary;
  },
};

const blobKey = (bookId: string, kind: BlobKind) => `${bookId}:${kind}`;

/**
 * Brand check, deliberately not `instanceof`.
 *
 * A value that has been through structured clone — which is what IndexedDB
 * does on the way in and out — can come back constructed in a different realm,
 * and `instanceof` compares against *this* realm's prototype. Measured here
 * under jsdom: the stored buffer reports `[object ArrayBuffer]` and
 * `constructor.name === 'ArrayBuffer'` while `x instanceof ArrayBuffer` is
 * false. An `instanceof` guard would therefore have rejected perfectly good
 * PDFs wherever a realm boundary sits between the store and the page.
 * `Object.prototype.toString` reads the internal slot instead, so it is true
 * of a real ArrayBuffer and of nothing else, in any realm.
 */
function isArrayBuffer(value: unknown): value is ArrayBuffer {
  return Object.prototype.toString.call(value) === '[object ArrayBuffer]';
}

export const blobs = {
  async put(bookId: string, kind: BlobKind, blob: Blob): Promise<void> {
    const bytes = await blob.arrayBuffer();
    await (
      await getDb()
    ).put('blobs', {
      key: blobKey(bookId, kind),
      bookId,
      kind,
      bytes,
      type: blob.type,
    });
  },

  /**
   * The stored bytes are checked, not trusted. `new Blob([x])` accepts anything
   * — hand it a string, a number, or the `{}` that fake-indexeddb returns for a
   * value it could not clone, and it happily builds a Blob out of that value's
   * text. The result is a "PDF" the reader opens to garbage, with no error
   * anywhere. Returning undefined instead takes the "no PDF stored" path every
   * caller already handles.
   */
  async get(bookId: string, kind: BlobKind): Promise<Blob | undefined> {
    const record = await (await getDb()).get('blobs', blobKey(bookId, kind));
    if (!record) return undefined;

    const bytes: unknown = record.bytes;
    if (!isArrayBuffer(bytes)) return undefined;

    return new Blob([bytes], { type: typeof record.type === 'string' ? record.type : '' });
  },

  async remove(bookId: string, kind: BlobKind): Promise<void> {
    await (await getDb()).delete('blobs', blobKey(bookId, kind));
  },
};
