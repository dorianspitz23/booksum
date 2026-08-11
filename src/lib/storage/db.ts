import { deleteDB, openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Book, Profile, ReviewCard, StoredBlob, Summary } from '../../types';

export const DB_NAME = 'booksum';
export const DB_VERSION = 1;

export interface BookSumDB extends DBSchema {
  profiles: { key: string; value: Profile };
  books: { key: string; value: Book; indexes: { 'by-profile': string } };
  summaries: { key: string; value: Summary; indexes: { 'by-book': string } };
  blobs: { key: string; value: StoredBlob; indexes: { 'by-book': string } };
  reviewCards: {
    key: string;
    value: ReviewCard;
    indexes: { 'by-profile-due': [string, string] };
  };
}

let dbPromise: Promise<IDBPDatabase<BookSumDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<BookSumDB>> {
  if (!dbPromise) {
    dbPromise = openDB<BookSumDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore('profiles', { keyPath: 'id' });

        const bookStore = db.createObjectStore('books', { keyPath: 'id' });
        bookStore.createIndex('by-profile', 'profileId');

        const summaryStore = db.createObjectStore('summaries', { keyPath: 'id' });
        summaryStore.createIndex('by-book', 'bookId');

        const blobStore = db.createObjectStore('blobs', { keyPath: 'key' });
        blobStore.createIndex('by-book', 'bookId');

        // Unused until Phase 3, created now so no version bump is needed later.
        const cardStore = db.createObjectStore('reviewCards', { keyPath: 'id' });
        cardStore.createIndex('by-profile-due', ['profileId', 'dueAt']);
      },
    });
  }
  return dbPromise;
}

/** Test-only: close and drop the database so each test starts clean. */
export async function resetDb(): Promise<void> {
  if (dbPromise) {
    (await dbPromise).close();
    dbPromise = null;
  }
  await deleteDB(DB_NAME);
}
