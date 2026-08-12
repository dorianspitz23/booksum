import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { blobs, books as bookRepo, summaries as summaryRepo } from '../../lib/storage/repo';
import { useProfile } from '../profile/ProfileContext';
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

      const summaryId = options.summary ? crypto.randomUUID() : undefined;
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
      let added = 0;

      for (const book of payload.books ?? []) {
        if (existing.has(book.id)) continue;
        await bookRepo.create({ ...book, profileId: profile.id });
        added += 1;
      }
      for (const summary of payload.summaries ?? []) {
        await summaryRepo.upsert(summary);
      }

      await reload();
      return added;
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
