import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '../../lib/storage/db';
import {
  blobs,
  books as bookRepo,
  profiles,
  summaries as summaryRepo,
} from '../../lib/storage/repo';
import { ACTIVE_PROFILE_KEY, ProfileProvider } from '../profile/ProfileContext';
import { LibraryProvider, useLibrary } from './useLibrary';
import type { Book, LibraryExport, Summary } from '../../types';

let api: ReturnType<typeof useLibrary>;

function Probe() {
  api = useLibrary();
  return <p data-testid="count">{api.isLoading ? 'loading' : String(api.books.length)}</p>;
}

async function renderLibrary() {
  const profile = await profiles.create({ name: 'Dorian' });
  localStorage.setItem(ACTIVE_PROFILE_KEY, profile.id);
  render(
    <ProfileProvider>
      <LibraryProvider>
        <Probe />
      </LibraryProvider>
    </ProfileProvider>,
  );
  await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('0'));
  return profile;
}

const draft = (title = 'Atomic Habits') => ({
  title,
  author: 'James Clear',
  category: 'Productivity',
  status: 'Finished' as const,
  rating: 5,
  readingTimeMinutes: 12,
  coverImageUrl: 'https://example.test/c.jpg',
  hasPdf: false,
});

beforeEach(async () => {
  await resetDb();
  localStorage.clear();
});

describe('useLibrary', () => {
  it('adds a book and exposes it', async () => {
    await renderLibrary();
    await act(async () => {
      await api.addBook(draft());
    });
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('1'));
  });

  it('persists across a remount', async () => {
    const profile = await renderLibrary();
    await act(async () => {
      await api.addBook(draft());
    });
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('1'));

    await expect(bookRepo.listByProfile(profile.id)).resolves.toHaveLength(1);
  });

  it('stores an attached PDF as a blob and keeps the record small', async () => {
    await renderLibrary();
    const bytes = new Uint8Array(10 * 1024 * 1024);
    let created!: Book;

    await act(async () => {
      created = await api.addBook(
        { ...draft('Big PDF'), hasPdf: true },
        { pdf: new Blob([bytes], { type: 'application/pdf' }) },
      );
    });

    const stored = await blobs.get(created.id, 'pdf');
    expect(stored?.size).toBe(bytes.byteLength);

    const record = await bookRepo.get(created.id);
    expect(JSON.stringify(record).length).toBeLessThan(1_000);
  });

  it('writes an attached summary and reads it back', async () => {
    await renderLibrary();
    let created!: Book;
    await act(async () => {
      created = await api.addBook(draft(), {
        summary: {
          oneSentenceTakeaway: 'Small changes compound.',
          summary: 'Body',
          keyInsights: ['One'],
          actionableSteps: ['Do'],
          generatedAt: new Date().toISOString(),
          model: 'test-model',
        },
      });
    });

    const summary = await api.getSummary(created.id);
    expect(summary?.oneSentenceTakeaway).toBe('Small changes compound.');
    expect((await bookRepo.get(created.id))?.summaryId).toBe(summary?.id);
  });

  it('removes a book and its blobs', async () => {
    await renderLibrary();
    let created!: Book;
    await act(async () => {
      created = await api.addBook({ ...draft(), hasPdf: true }, { pdf: new Blob(['x']) });
    });

    await act(async () => {
      await api.removeBook(created.id);
    });

    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('0'));
    await expect(blobs.get(created.id, 'pdf')).resolves.toBeUndefined();
  });
});

/**
 * Restoring a backup used to skip duplicate books but upsert their summaries
 * unconditionally, so importing an older export silently replaced newer local
 * summaries for every book already in the library.
 */
describe('useLibrary.importLibrary', () => {
  const summaryFor = (bookId: string, text: string): Summary => ({
    id: `sum-${bookId}`,
    bookId,
    oneSentenceTakeaway: text,
    summary: text,
    keyInsights: [],
    actionableSteps: [],
    generatedAt: '2026-01-01T00:00:00.000Z',
    model: 'test',
  });

  const exportOf = (books: Book[], summaries: Summary[]): LibraryExport => ({
    version: 2,
    exportedAt: '2026-01-01T00:00:00.000Z',
    books,
    summaries,
  });

  it('does not overwrite the summary of a book it skipped as a duplicate', async () => {
    const profile = await renderLibrary();
    let mine!: Book;
    await act(async () => {
      mine = await api.addBook(draft(), {
        summary: {
          oneSentenceTakeaway: 'MINE — newer',
          summary: 'MINE — newer',
          keyInsights: [],
          actionableSteps: [],
          generatedAt: '2026-06-01T00:00:00.000Z',
          model: 'test',
        },
      });
    });

    let added = -1;
    await act(async () => {
      added = await api.importLibrary(
        exportOf(
          [{ ...mine, profileId: profile.id }],
          [summaryFor(mine.id, 'BACKUP — older, must not win')],
        ),
      );
    });

    expect(added).toBe(0);
    const summary = await api.getSummary(mine.id);
    expect(summary?.oneSentenceTakeaway).toBe('MINE — newer');

    // The real defect was a duplicate row, not an overwrite: upsert keys on the
    // summary's own id, which differs per device, so the backup's summary landed
    // alongside the local one. getByBook then returned whichever sorted first by
    // primary key, and books.remove only ever deleted that one.
    await expect(summaryRepo.listByBook(mine.id)).resolves.toHaveLength(1);
  });

  it('leaves no orphan summary row behind when the book is later deleted', async () => {
    const profile = await renderLibrary();
    let mine!: Book;
    await act(async () => {
      mine = await api.addBook(draft(), {
        summary: {
          oneSentenceTakeaway: 'MINE',
          summary: 'MINE',
          keyInsights: [],
          actionableSteps: [],
          generatedAt: '2026-06-01T00:00:00.000Z',
          model: 'test',
        },
      });
    });

    await act(async () => {
      await api.importLibrary(
        exportOf([{ ...mine, profileId: profile.id }], [summaryFor(mine.id, 'BACKUP')]),
      );
    });
    await act(async () => {
      await api.removeBook(mine.id);
    });

    await expect(summaryRepo.listByBook(mine.id)).resolves.toHaveLength(0);
  });

  it('ignores a summary whose book is not in the library', async () => {
    await renderLibrary();

    await act(async () => {
      await api.importLibrary(exportOf([], [summaryFor('no-such-book', 'ORPHAN')]));
    });

    await expect(summaryRepo.listByBook('no-such-book')).resolves.toHaveLength(0);
  });

  it('writes the summary of a book it actually imported', async () => {
    const profile = await renderLibrary();
    const incoming: Book = {
      ...draft('Deep Work'),
      id: 'incoming-1',
      profileId: profile.id,
      addedAt: '2026-01-01T00:00:00.000Z',
    };

    await act(async () => {
      await api.importLibrary(
        exportOf([incoming], [summaryFor('incoming-1', 'BACKUP — the only copy')]),
      );
    });

    const summary = await api.getSummary('incoming-1');
    expect(summary?.oneSentenceTakeaway).toBe('BACKUP — the only copy');
  });

  it('fills in a summary when the existing book has none', async () => {
    const profile = await renderLibrary();
    let bare!: Book;
    await act(async () => {
      bare = await api.addBook(draft('Unsummarised'));
    });

    await act(async () => {
      await api.importLibrary(
        exportOf(
          [{ ...bare, profileId: profile.id }],
          [summaryFor(bare.id, 'BACKUP — fills a gap')],
        ),
      );
    });

    const summary = await api.getSummary(bare.id);
    expect(summary?.oneSentenceTakeaway).toBe('BACKUP — fills a gap');
  });

  it('is safe to run twice', async () => {
    const profile = await renderLibrary();
    const incoming: Book = {
      ...draft('Deep Work'),
      id: 'incoming-1',
      profileId: profile.id,
      addedAt: '2026-01-01T00:00:00.000Z',
    };
    const payload = exportOf([incoming], [summaryFor('incoming-1', 'BACKUP')]);

    let first = -1;
    let second = -1;
    await act(async () => {
      first = await api.importLibrary(payload);
    });
    await act(async () => {
      second = await api.importLibrary(payload);
    });

    expect(first).toBe(1);
    expect(second).toBe(0);
    await expect(bookRepo.listByProfile(profile.id)).resolves.toHaveLength(1);
  });
});
