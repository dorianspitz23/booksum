import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from './db';
import { migrateLegacyData, MIGRATION_MARKER } from './migrate';
import { blobs, books, profiles, summaries } from './repo';

const LEGACY_USER_ID = 'user_abc123';

function seedLegacyLocalStorage() {
  localStorage.setItem(
    'booksum_db_users',
    JSON.stringify([
      { id: LEGACY_USER_ID, name: 'Dorian', email: 'd@example.test', password: 'hunter2' },
    ]),
  );
  localStorage.setItem(
    `booksum_profile_${LEGACY_USER_ID}`,
    JSON.stringify({
      name: 'Dorian',
      monthlyGoal: 8,
      joinedAt: '2026-01-01T00:00:00.000Z',
      bio: 'Reader',
      favoriteVoice: 'Puck',
    }),
  );
  localStorage.setItem(
    `booksum_library_${LEGACY_USER_ID}`,
    JSON.stringify([
      {
        id: 'book-1',
        title: 'Atomic Habits',
        author: 'James Clear',
        category: 'Productivity',
        oneSentenceTakeaway: 'Small changes compound.',
        summary: 'A summary.',
        keyInsights: ['One', 'Two'],
        actionableSteps: ['Do a thing'],
        coverImageUrl: 'https://example.test/cover.jpg',
        rating: 5,
        readingTimeMinutes: 12,
        addedAt: '2026-02-01T00:00:00.000Z',
        status: 'Finished',
        pdfData: btoa('fake pdf bytes'),
      },
      {
        id: 'book-2',
        title: 'Deep Work',
        author: 'Cal Newport',
        category: 'Productivity',
        oneSentenceTakeaway: 'Focus is a skill.',
        summary: 'Another summary.',
        keyInsights: [],
        actionableSteps: [],
        coverImageUrl: 'https://example.test/dw.jpg',
        rating: 4,
        readingTimeMinutes: 9,
        addedAt: '2026-03-01T00:00:00.000Z',
        status: 'Want to Read',
        priority: 'High',
      },
    ]),
  );
}

beforeEach(async () => {
  await resetDb();
  localStorage.clear();
});

describe('migrateLegacyData', () => {
  it('reports nothing to do when there is no legacy data', async () => {
    const result = await migrateLegacyData();
    expect(result).toEqual({
      migrated: false,
      profiles: 0,
      books: 0,
      summaries: 0,
      blobs: 0,
      failed: 0,
    });
  });

  it('creates one profile per legacy library key', async () => {
    seedLegacyLocalStorage();
    const result = await migrateLegacyData();

    expect(result.migrated).toBe(true);
    expect(result.profiles).toBe(1);

    const [profile] = await profiles.list();
    expect(profile?.name).toBe('Dorian');
    expect(profile?.monthlyGoal).toBe(8);
    expect(profile?.favoriteVoice).toBe('Puck');
  });

  it('splits each legacy book into a Book and a Summary', async () => {
    seedLegacyLocalStorage();
    await migrateLegacyData();

    const [profile] = await profiles.list();
    const migrated = await books.listByProfile(profile!.id);
    expect(migrated).toHaveLength(2);

    const atomic = migrated.find((b) => b.title === 'Atomic Habits');
    expect(atomic?.status).toBe('Finished');
    expect(atomic?.hasPdf).toBe(true);
    expect(atomic?.readingTimeMinutes).toBe(12);
    expect(atomic?.summaryId).toBeTruthy();
    expect('pdfData' in (atomic as object)).toBe(false);

    const summary = await summaries.getByBook(atomic!.id);
    expect(summary?.keyInsights).toEqual(['One', 'Two']);
    expect(summary?.model).toBe('legacy');
  });

  it('moves base64 PDF data into the blob store', async () => {
    seedLegacyLocalStorage();
    await migrateLegacyData();

    const [profile] = await profiles.list();
    const migrated = await books.listByProfile(profile!.id);
    const atomic = migrated.find((b) => b.title === 'Atomic Habits');

    const pdf = await blobs.get(atomic!.id, 'pdf');
    expect(await pdf?.text()).toBe('fake pdf bytes');
  });

  it('never copies the legacy password into the database', async () => {
    seedLegacyLocalStorage();
    await migrateLegacyData();

    const dump = JSON.stringify(await profiles.list());
    expect(dump).not.toContain('hunter2');
    expect(dump).not.toContain('password');
  });

  it('leaves the legacy localStorage keys in place', async () => {
    seedLegacyLocalStorage();
    await migrateLegacyData();

    expect(localStorage.getItem(`booksum_library_${LEGACY_USER_ID}`)).not.toBeNull();
    expect(localStorage.getItem(MIGRATION_MARKER)).not.toBeNull();
  });

  it('is idempotent', async () => {
    seedLegacyLocalStorage();
    await migrateLegacyData();
    const second = await migrateLegacyData();

    expect(second.migrated).toBe(false);
    await expect(profiles.list()).resolves.toHaveLength(1);
  });

  it('falls back to a default name when no legacy profile record exists', async () => {
    localStorage.setItem(`booksum_library_orphan`, JSON.stringify([]));
    await migrateLegacyData();

    const [profile] = await profiles.list();
    expect(profile?.name).toBe('Reader');
  });
});

/**
 * The migration runs unguarded on the boot path, and the marker used to be
 * written only after the whole loop succeeded. One unreadable record therefore
 * aborted the run, left the marker unwritten, and re-imported everything it had
 * already written on the next reload.
 */
describe('migrateLegacyData with unreadable legacy data', () => {
  function seedWithOneBadBook() {
    localStorage.setItem(
      `booksum_library_${LEGACY_USER_ID}`,
      JSON.stringify([
        {
          id: 'book-bad',
          title: 'Corrupt Attachment',
          author: 'Nobody',
          status: 'Finished',
          // atob throws InvalidCharacterError on anything outside the alphabet.
          pdfData: '!!! not base64 !!!',
        },
        {
          id: 'book-good',
          title: 'Deep Work',
          author: 'Cal Newport',
          status: 'Finished',
        },
      ]),
    );
  }

  it('keeps the book, drops only the attachment it cannot decode', async () => {
    seedWithOneBadBook();

    const result = await migrateLegacyData();

    expect(result.migrated).toBe(true);
    expect(result.failed).toBe(1);
    expect(result.books).toBe(2);
    expect(result.blobs).toBe(0);

    const [profile] = await profiles.list();
    const migrated = await books.listByProfile(profile!.id);
    expect(migrated).toHaveLength(2);
  });

  it('records hasPdf false when the attachment could not be decoded', async () => {
    seedWithOneBadBook();
    await migrateLegacyData();

    const [profile] = await profiles.list();
    const migrated = await books.listByProfile(profile!.id);
    const corrupt = migrated.find((b) => b.title === 'Corrupt Attachment');

    // hasPdf used to be copied from the legacy record, leaving a book that
    // claims a PDF the blob store does not have.
    expect(corrupt?.hasPdf).toBe(false);
  });

  it('still writes the marker, so a reload cannot re-import the same data', async () => {
    seedWithOneBadBook();

    await migrateLegacyData();
    expect(localStorage.getItem(MIGRATION_MARKER)).not.toBeNull();

    const second = await migrateLegacyData();

    expect(second.migrated).toBe(false);
    await expect(profiles.list()).resolves.toHaveLength(1);
  });
});
