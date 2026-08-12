import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '../../lib/storage/db';
import { blobs, books as bookRepo, profiles } from '../../lib/storage/repo';
import { ACTIVE_PROFILE_KEY, ProfileProvider } from '../profile/ProfileContext';
import { LibraryProvider, useLibrary } from './useLibrary';
import type { Book } from '../../types';

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
