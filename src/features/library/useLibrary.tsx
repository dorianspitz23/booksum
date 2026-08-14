import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { blobs, books as bookRepo, summaries as summaryRepo } from '../../lib/storage/repo';
import { useProfile } from '../profile/ProfileContext';
import { coverForIsbn } from '../../lib/goodreads';
import type { GoodreadsRow } from '../../lib/goodreads';
import { placeholderCover } from '../../lib/covers';
import { newId } from '../../lib/id';
import { parseReadDate } from '../../lib/stats';
import type { Book, LibraryExport, Summary } from '../../types';

export type BookDraft = Omit<Book, 'id' | 'profileId' | 'addedAt' | 'summaryId'>;

export interface AddBookOptions {
  summary?: Omit<Summary, 'id' | 'bookId'>;
  pdf?: Blob;
}

function useLibraryState() {
  const { profile, isLoading: profileLoading } = useProfile();
  const [books, setBooks] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const reload = useCallback(async () => {
    // Stay loading until the profile context settles. Reporting "loaded" with an
    // unresolved profile lets callers act on a null profile and lose their write.
    if (profileLoading) return;

    if (!profile) {
      setBooks([]);
      setIsLoading(false);
      return;
    }
    setBooks(await bookRepo.listByProfile(profile.id));
    setIsLoading(false);
  }, [profile, profileLoading]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const addBook = useCallback(
    async (draft: BookDraft, options: AddBookOptions = {}): Promise<Book> => {
      if (!profile) throw new Error('No active profile');

      const summaryId = options.summary ? newId() : undefined;
      const book = await bookRepo.create({ ...draft, profileId: profile.id, summaryId });

      if (options.summary && summaryId) {
        await summaryRepo.upsert({ ...options.summary, id: summaryId, bookId: book.id });
      }
      if (options.pdf) {
        await blobs.put(book.id, 'pdf', options.pdf);
      }

      await reload();
      return book;
    },
    [profile, reload],
  );

  const updateBook = useCallback(
    async (book: Book) => {
      await bookRepo.update(book);
      await reload();
    },
    [reload],
  );

  const removeBook = useCallback(
    async (id: string) => {
      await bookRepo.remove(id);
      await reload();
    },
    [reload],
  );

  const getSummary = useCallback((bookId: string) => summaryRepo.getByBook(bookId), []);

  const saveSummary = useCallback(
    async (summary: Summary) => {
      await summaryRepo.upsert(summary);
      const book = await bookRepo.get(summary.bookId);
      if (book && book.summaryId !== summary.id) {
        await bookRepo.update({ ...book, summaryId: summary.id });
        await reload();
      }
    },
    [reload],
  );

  const exportLibrary = useCallback(async (): Promise<LibraryExport> => {
    const all = profile ? await bookRepo.listByProfile(profile.id) : [];
    const found = await Promise.all(all.map((book) => summaryRepo.getByBook(book.id)));
    return {
      version: 2,
      exportedAt: new Date().toISOString(),
      books: all,
      summaries: found.filter((s): s is Summary => s !== undefined),
    };
  }, [profile]);

  /** Merges a backup into the active profile. Returns how many books were new. */
  const importLibrary = useCallback(
    async (payload: LibraryExport): Promise<number> => {
      if (!profile) return 0;

      const existing = new Set((await bookRepo.listByProfile(profile.id)).map((b) => b.id));
      const imported = new Set<string>();
      let added = 0;

      for (const book of payload.books ?? []) {
        if (existing.has(book.id)) continue;
        await bookRepo.create({ ...book, profileId: profile.id });
        imported.add(book.id);
        added += 1;
      }

      // A summary is written only for a book that was just imported, or for one
      // that has no summary yet. Upserting unconditionally keyed on the summary's
      // own id -- which differs between devices -- so importing a backup over an
      // existing library added a second summary row for every book it skipped.
      // Those orphans outlived the book itself, because books.remove only ever
      // found the first of them.
      for (const summary of payload.summaries ?? []) {
        const book = await bookRepo.get(summary.bookId);
        if (!book || book.profileId !== profile.id) continue;
        if (!imported.has(summary.bookId) && (await summaryRepo.getByBook(summary.bookId)))
          continue;

        await summaryRepo.upsert(summary);
        if (book.summaryId !== summary.id) {
          await bookRepo.update({ ...book, summaryId: summary.id });
        }
      }

      await reload();
      return added;
    },
    [profile, reload],
  );

  /**
   * Creates one library entry per Goodreads row. Deliberately makes no AI call:
   * summaries are generated later, per book, on demand.
   */
  const importGoodreadsRows = useCallback(
    async (rows: GoodreadsRow[]): Promise<{ added: number; duplicates: number }> => {
      if (!profile) return { added: 0, duplicates: 0 };

      const keyOf = (title: string, author: string) =>
        `${title.trim().toLowerCase()}|${author.trim().toLowerCase()}`;

      const existing = new Set(
        (await bookRepo.listByProfile(profile.id)).map((b) => keyOf(b.title, b.author)),
      );

      let added = 0;
      let duplicates = 0;

      for (const row of rows) {
        const key = keyOf(row.title, row.author);
        if (existing.has(key)) {
          duplicates += 1;
          continue;
        }
        existing.add(key);

        await bookRepo.create({
          profileId: profile.id,
          title: row.title,
          author: row.author,
          category: 'Other',
          status: row.status,
          rating: row.rating,
          readingTimeMinutes: 0,
          coverImageUrl: coverForIsbn(row.isbn13) ?? placeholderCover(row.title),
          hasPdf: false,
          // The CSV's Date Read column was parsed and then discarded, so every
          // imported book arrived with no completion date and could never count
          // toward a monthly goal.
          finishedAt: row.status === 'Finished' ? parseReadDate(row.dateRead) : undefined,
        });
        added += 1;
      }

      await reload();
      return { added, duplicates };
    },
    [profile, reload],
  );

  return {
    books,
    isLoading,
    addBook,
    updateBook,
    removeBook,
    getSummary,
    saveSummary,
    exportLibrary,
    importLibrary,
    importGoodreadsRows,
    reload,
  };
}

export type LibraryApi = ReturnType<typeof useLibraryState>;

const LibraryContext = createContext<LibraryApi | undefined>(undefined);

/**
 * One library instance for the whole app. Without this each routed page would
 * mount its own copy and re-query IndexedDB on every navigation.
 */
export function LibraryProvider({ children }: { children: ReactNode }) {
  const value = useLibraryState();
  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary(): LibraryApi {
  const context = useContext(LibraryContext);
  if (!context) throw new Error('useLibrary must be used within a LibraryProvider');
  return context;
}
