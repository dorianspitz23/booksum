import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '../../lib/storage/db';
import {
  blobs,
  books as bookRepo,
  profiles,
  reviewCards as cardRepo,
  summaries as summaryRepo,
} from '../../lib/storage/repo';
import { newCard } from '../../lib/srs';
import { ACTIVE_PROFILE_KEY, ProfileProvider } from '../profile/ProfileContext';
import { LibraryProvider, useLibrary } from './useLibrary';
import type { Book, LibraryExport, Summary } from '../../types';
import { defined } from '../../test/defined';

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

    // This assertion is also the only guard on a realm trap in blobs.get, and
    // it is worth knowing why. That method validates the stored bytes before
    // building a Blob out of them, and the obvious check — `instanceof
    // ArrayBuffer` — is wrong: a structured-cloned buffer can arrive
    // constructed in another realm, where instanceof compares against the wrong
    // prototype and reports false for a perfectly good buffer. This suite runs
    // under jsdom, which is exactly such a boundary, so an instanceof guard
    // fails here (undefined instead of 10 MB) while repo.test.ts, running in
    // node, passes. If this line ever fails with `undefined`, look at the
    // brand check in blobs.get before looking anywhere else.
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

  /**
   * `oneSentenceTakeaway` is denormalised onto `Book` so the library grid can
   * render without loading every summary — but `saveSummary` used to update
   * `summaryId` alone. Regenerating a summary therefore left the copy behind,
   * and the card quoted the old sentence while the book's own page quoted the
   * new one, with nothing to say which was current.
   */
  it('re-syncs the takeaway denormalised onto the book when a summary is replaced', async () => {
    await renderLibrary();
    let created!: Book;
    await act(async () => {
      created = await api.addBook(draft(), {
        summary: {
          oneSentenceTakeaway: 'The first take.',
          summary: 'Body',
          keyInsights: [],
          actionableSteps: [],
          generatedAt: new Date().toISOString(),
          model: 'test-model',
        },
      });
    });

    const original = await api.getSummary(created.id);
    expect((await bookRepo.get(created.id))?.oneSentenceTakeaway).toBe('The first take.');

    await act(async () => {
      await api.saveSummary({
        ...(original as Summary),
        oneSentenceTakeaway: 'A completely different take.',
      });
    });

    expect((await bookRepo.get(created.id))?.oneSentenceTakeaway).toBe(
      'A completely different take.',
    );
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
    version: 3,
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

  /**
   * Two profiles on one device, one backup file. Book ids are preserved on
   * import so summaries and review cards can re-link by `bookId`, but
   * `books.create` is a `put` and the duplicate guard only sees the *importing*
   * profile's books. The second import therefore overwrote the record and moved
   * the book — along with its summary, its PDF and its review cards — out of the
   * first profile's library. Nothing warned; their book count simply went down.
   */
  it('does not steal a book from another profile that shares its id', async () => {
    const other = await profiles.create({ name: 'Someone else' });
    const theirs = await bookRepo.create({ ...draft('Deep Work'), profileId: other.id });

    const profile = await renderLibrary();
    let added = -1;
    await act(async () => {
      added = await api.importLibrary(
        exportOf(
          [{ ...theirs, profileId: 'whatever-the-backup-said' }],
          [summaryFor(theirs.id, 'From the backup')],
        ),
      );
    });

    expect(added).toBe(1);

    // The other profile still owns its original record, untouched.
    const stillTheirs = await bookRepo.get(theirs.id);
    expect(stillTheirs?.profileId).toBe(other.id);
    await expect(bookRepo.listByProfile(other.id)).resolves.toHaveLength(1);

    // And the importer got its own copy, under a fresh id.
    const mine = await bookRepo.listByProfile(profile.id);
    expect(mine).toHaveLength(1);
    expect(defined(mine[0], 'imported copy').id).not.toBe(theirs.id);

    // The summary followed that copy rather than being left pointing at a book
    // belonging to someone else.
    const summary = await summaryRepo.getByBook(defined(mine[0], 'imported copy').id);
    expect(summary?.summary).toBe('From the backup');
  });
});

describe('backup completeness', () => {
  const exportOf = (books: Book[], summaries: Summary[]): LibraryExport => ({
    version: 3,
    exportedAt: '2026-01-01T00:00:00.000Z',
    books,
    summaries,
  });

  it('carries the review schedule and the profile settings', async () => {
    const profile = await renderLibrary();
    let book!: Book;
    await act(async () => {
      book = await api.addBook(draft('Atomic Habits'));
    });
    await cardRepo.upsert(
      newCard({
        profileId: profile.id,
        bookId: book.id,
        question: 'What is habit stacking?',
        options: ['a', 'b', 'c', 'd'],
        correctAnswerIndex: 1,
        explanation: 'because',
      }),
    );

    let payload!: LibraryExport;
    await act(async () => {
      payload = await api.exportLibrary();
    });

    // A v2 backup carried books and summaries only, so moving devices lost every
    // setting and the entire spaced-repetition schedule — the one dataset that
    // costs money to rebuild, since cards only come from an AI-generated quiz.
    expect(payload.version).toBe(3);
    expect(payload.reviewCards).toHaveLength(1);
    expect(payload.reviewCards?.[0]?.question).toBe('What is habit stacking?');
    expect(payload.profile?.favoriteVoice).toBe(profile.favoriteVoice);
    expect(payload.profile?.monthlyGoal).toBe(profile.monthlyGoal);
  });

  it('restores review cards onto the importing profile', async () => {
    const profile = await renderLibrary();
    const incoming: Book = {
      ...draft('Deep Work'),
      id: 'incoming-1',
      profileId: 'a-different-device',
      addedAt: '2026-01-01T00:00:00.000Z',
    };
    const card = newCard({
      profileId: 'a-different-device',
      bookId: 'incoming-1',
      question: 'What is deep work?',
      options: ['a', 'b', 'c', 'd'],
      correctAnswerIndex: 0,
      explanation: 'because',
    });

    await act(async () => {
      await api.importLibrary({ ...exportOf([incoming], []), reviewCards: [card] });
    });

    const restored = await cardRepo.listByProfile(profile.id);
    // Profile ids are per-device, so a card imported with its original id would
    // belong to a profile that does not exist here and never surface again.
    expect(restored).toHaveLength(1);
    expect(restored[0]?.profileId).toBe(profile.id);
  });

  it('keeps the local schedule for a card the backup also has', async () => {
    const profile = await renderLibrary();
    let book!: Book;
    await act(async () => {
      book = await api.addBook(draft('Atomic Habits'));
    });

    const local = await cardRepo.upsert({
      ...newCard({
        profileId: profile.id,
        bookId: book.id,
        question: 'Q',
        options: ['a', 'b', 'c', 'd'],
        correctAnswerIndex: 0,
        explanation: '',
      }),
      intervalDays: 30,
      reviewCount: 9,
    });

    await act(async () => {
      await api.importLibrary({
        ...exportOf([], []),
        reviewCards: [{ ...local, intervalDays: 1, reviewCount: 0 }],
      });
    });

    const [after] = await cardRepo.listByProfile(profile.id);
    // Restoring the backup's older schedule over locally-earned progress would
    // undo real review work, so a card already present is left alone.
    expect(after?.intervalDays).toBe(30);
    expect(after?.reviewCount).toBe(9);
  });
});
