import { getDb } from './db';
import type { BlobKind, Book, Profile, ReviewCard, Summary } from '../../types';

const newId = () => crypto.randomUUID();

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

  async remove(id: string): Promise<void> {
    const owned = await books.listByProfile(id);
    await Promise.all(owned.map((book) => books.remove(book.id)));
    await (await getDb()).delete('profiles', id);
  },
};

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

  async remove(id: string): Promise<void> {
    const summary = await summaries.getByBook(id);
    if (summary) await summaries.remove(summary.id);
    await blobs.removeByBook(id);
    await reviewCards.removeByBook(id);
    await (await getDb()).delete('books', id);
  },
};

export const reviewCards = {
  async listByProfile(profileId: string): Promise<ReviewCard[]> {
    const all = await (await getDb()).getAll('reviewCards');
    return all.filter((card) => card.profileId === profileId);
  },

  /** ISO timestamps sort chronologically, so a string compare is enough. */
  async listDue(profileId: string, now: Date = new Date()): Promise<ReviewCard[]> {
    const cutoff = now.toISOString();
    const owned = await reviewCards.listByProfile(profileId);
    return owned
      .filter((card) => card.dueAt <= cutoff)
      .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  },

  // Filtered in memory rather than via an index: the v1 schema has no by-book
  // index, and a book carries only a handful of cards.
  async listByBook(bookId: string): Promise<ReviewCard[]> {
    const all = await (await getDb()).getAll('reviewCards');
    return all.filter((card) => card.bookId === bookId);
  },

  async upsert(card: ReviewCard): Promise<ReviewCard> {
    await (await getDb()).put('reviewCards', card);
    return card;
  },

  async removeByBook(bookId: string): Promise<void> {
    const db = await getDb();
    const owned = await reviewCards.listByBook(bookId);
    await Promise.all(owned.map((card) => db.delete('reviewCards', card.id)));
  },
};

export const summaries = {
  async getByBook(bookId: string): Promise<Summary | undefined> {
    return (await getDb()).getFromIndex('summaries', 'by-book', bookId);
  },

  async upsert(summary: Summary): Promise<Summary> {
    await (await getDb()).put('summaries', summary);
    return summary;
  },

  async remove(id: string): Promise<void> {
    await (await getDb()).delete('summaries', id);
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

  async removeByBook(bookId: string): Promise<void> {
    const db = await getDb();
    const keys = await db.getAllKeysFromIndex('blobs', 'by-book', bookId);
    await Promise.all(keys.map((key) => db.delete('blobs', key)));
  },
};
