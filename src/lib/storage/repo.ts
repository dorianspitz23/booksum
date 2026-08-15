import type { IDBPTransaction } from 'idb';
import { getDb } from './db';
import type { BookSumDB } from './db';
import { newId } from '../id';
import type { BlobKind, Book, Profile, ReviewCard, Summary } from '../../types';

export const profiles = {
  async list(): Promise<Profile[]> {
    const all = await (await getDb()).getAll('profiles');
    return all.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
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

  async upsert(card: ReviewCard): Promise<ReviewCard> {
    await (await getDb()).put('reviewCards', card);
    return card;
  },

  async removeByBook(bookId: string): Promise<void> {
    const db = await getDb();
    const keys = await db.getAllKeysFromIndex('reviewCards', 'by-book', bookId);
    const tx = db.transaction('reviewCards', 'readwrite');
    for (const key of keys) await tx.store.delete(key);
    await tx.done;
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

  async remove(id: string): Promise<void> {
    await (await getDb()).delete('summaries', id);
  },

  async removeByBook(bookId: string): Promise<void> {
    const db = await getDb();
    const keys = await db.getAllKeysFromIndex('summaries', 'by-book', bookId);
    const tx = db.transaction('summaries', 'readwrite');
    for (const key of keys) await tx.store.delete(key);
    await tx.done;
  },
};

const blobKey = (bookId: string, kind: BlobKind) => `${bookId}:${kind}`;

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

  async get(bookId: string, kind: BlobKind): Promise<Blob | undefined> {
    const record = await (await getDb()).get('blobs', blobKey(bookId, kind));
    return record ? new Blob([record.bytes], { type: record.type }) : undefined;
  },

  async remove(bookId: string, kind: BlobKind): Promise<void> {
    await (await getDb()).delete('blobs', blobKey(bookId, kind));
  },

  async removeByBook(bookId: string): Promise<void> {
    const db = await getDb();
    const keys = await db.getAllKeysFromIndex('blobs', 'by-book', bookId);
    const tx = db.transaction('blobs', 'readwrite');
    for (const key of keys) await tx.store.delete(key);
    await tx.done;
  },
};
