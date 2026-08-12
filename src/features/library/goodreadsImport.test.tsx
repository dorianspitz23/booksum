import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDb } from '../../lib/storage/db';
import { books as bookRepo, profiles } from '../../lib/storage/repo';
import { ACTIVE_PROFILE_KEY, ProfileProvider } from '../profile/ProfileContext';
import { LibraryProvider, useLibrary } from './useLibrary';
import { parseGoodreadsCsv } from '../../lib/goodreads';

const CSV = [
  'Book Id,Title,Author,My Rating,Exclusive Shelf,ISBN13,Date Read',
  '1,Atomic Habits,James Clear,5,read,="9780735211292",2026/02/01',
  '2,Deep Work,Cal Newport,0,to-read,="",',
].join('\n');

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

beforeEach(async () => {
  await resetDb();
  localStorage.clear();
});

describe('Goodreads import', () => {
  it('adds one book per row with the right status and rating', async () => {
    const profile = await renderLibrary();
    const { rows } = parseGoodreadsCsv(CSV);

    await act(async () => {
      await api.importGoodreadsRows(rows);
    });

    const imported = await bookRepo.listByProfile(profile.id);
    expect(imported).toHaveLength(2);

    const atomic = imported.find((b) => b.title === 'Atomic Habits');
    expect(atomic).toMatchObject({ status: 'Finished', rating: 5, readingTimeMinutes: 0 });
    expect(atomic?.summaryId).toBeUndefined();
    expect(atomic?.coverImageUrl).toContain('9780735211292');

    const deep = imported.find((b) => b.title === 'Deep Work');
    expect(deep?.status).toBe('Want to Read');
    expect(deep?.coverImageUrl.startsWith('data:image/svg+xml,')).toBe(true);
  });

  it('skips duplicates on a second import of the same file', async () => {
    await renderLibrary();
    const { rows } = parseGoodreadsCsv(CSV);

    await act(async () => {
      await api.importGoodreadsRows(rows);
    });

    let second!: { added: number; duplicates: number };
    await act(async () => {
      second = await api.importGoodreadsRows(rows);
    });

    expect(second).toEqual({ added: 0, duplicates: 2 });
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('2'));
  });

  it('makes no Gemini call while importing', async () => {
    const fetchSpy = vi.fn(async (input: RequestInfo | URL) => {
      void input;
      return new Response('{}', { status: 200 });
    });
    vi.stubGlobal('fetch', fetchSpy);

    await renderLibrary();
    const { rows } = parseGoodreadsCsv(CSV);
    await act(async () => {
      await api.importGoodreadsRows(rows);
    });

    for (const call of fetchSpy.mock.calls) {
      expect(String(call[0])).not.toContain('generativelanguage');
    }
    vi.unstubAllGlobals();
  });

  it('imports a large library without any AI cost', async () => {
    await renderLibrary();
    const many = Array.from({ length: 200 }, (_, i) => ({
      title: `Book ${i}`,
      author: 'Someone',
      status: 'Want to Read' as const,
      rating: 0,
    }));

    let result!: { added: number; duplicates: number };
    await act(async () => {
      result = await api.importGoodreadsRows(many);
    });

    expect(result.added).toBe(200);
  });
});
