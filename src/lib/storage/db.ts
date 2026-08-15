import { deleteDB, openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Book, Profile, ReviewCard, StoredBlob, Summary } from '../../types';

export const DB_NAME = 'booksum';

/**
 * v2 adds `reviewCards.by-book`. Without it, deleting a book had to read every
 * card of every profile and filter in memory, so removing a 300-book Goodreads
 * import performed 300 full scans of the card store.
 */
export const DB_VERSION = 2;

export interface BookSumDB extends DBSchema {
  profiles: { key: string; value: Profile };
  books: { key: string; value: Book; indexes: { 'by-profile': string } };
  summaries: { key: string; value: Summary; indexes: { 'by-book': string } };
  blobs: { key: string; value: StoredBlob; indexes: { 'by-book': string } };
  reviewCards: {
    key: string;
    value: ReviewCard;
    indexes: { 'by-profile-due': [string, string]; 'by-book': string };
  };
}

let dbPromise: Promise<IDBPDatabase<BookSumDB>> | null = null;

export class StorageUnavailableError extends Error {
  constructor(cause?: unknown) {
    super(
      'BookSum could not open its local database. Private browsing or blocked site data can cause this.',
    );
    this.name = 'StorageUnavailableError';
    this.cause = cause;
  }
}

export function getDb(): Promise<IDBPDatabase<BookSumDB>> {
  if (!dbPromise) {
    dbPromise = openDB<BookSumDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, _newVersion, transaction) {
        if (oldVersion < 1) {
          db.createObjectStore('profiles', { keyPath: 'id' });

          const bookStore = db.createObjectStore('books', { keyPath: 'id' });
          bookStore.createIndex('by-profile', 'profileId');

          const summaryStore = db.createObjectStore('summaries', { keyPath: 'id' });
          summaryStore.createIndex('by-book', 'bookId');

          const blobStore = db.createObjectStore('blobs', { keyPath: 'key' });
          blobStore.createIndex('by-book', 'bookId');

          const cardStore = db.createObjectStore('reviewCards', { keyPath: 'id' });
          cardStore.createIndex('by-profile-due', ['profileId', 'dueAt']);
        }

        if (oldVersion < 2) {
          // For a v1 database the store already exists, so reach it through the
          // upgrade transaction rather than creating it again.
          const cardStore = transaction.objectStore('reviewCards');
          if (!cardStore.indexNames.contains('by-book')) {
            cardStore.createIndex('by-book', 'bookId');
          }
        }
      },

      // Another tab holding the old version blocks this upgrade indefinitely.
      // Previously there was no handler at all, so the app simply hung on boot
      // with no explanation the first time the version was ever bumped.
      blocked() {
        console.warn('[booksum] database upgrade is blocked by another open tab');
      },
      blocking() {
        // This tab is the one holding an old version open. Close it so the other
        // tab can upgrade rather than both waiting on each other.
        console.warn('[booksum] closing this connection so another tab can upgrade');
        void dbPromise?.then((db) => db.close());
        dbPromise = null;
      },
      terminated() {
        // The browser dropped the connection (storage pressure, or the user
        // cleared site data). Drop the cached promise so the next call reopens.
        console.warn('[booksum] database connection was terminated; will reopen on next use');
        dbPromise = null;
      },
    }).catch((error) => {
      // Without this the rejection propagated raw to whichever caller happened to
      // be first, which on the boot path meant an unexplained crash screen.
      dbPromise = null;
      throw new StorageUnavailableError(error);
    });
  }
  return dbPromise;
}

/** Test-only: close and drop the database so each test starts clean. */
export async function resetDb(): Promise<void> {
  if (dbPromise) {
    try {
      (await dbPromise).close();
    } catch {
      // Already closed or never opened; nothing to release.
    }
    dbPromise = null;
  }
  await deleteDB(DB_NAME);
}
