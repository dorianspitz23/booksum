/**
 * @vitest-environment node
 *
 * Needs localStorage but no DOM; setup.ts supplies an in-memory Storage.
 */
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
    const migrated = await books.listByProfile(profile.id);
    expect(migrated).toHaveLength(2);

    const atomic = migrated.find((b) => b.title === 'Atomic Habits');
    expect(atomic?.status).toBe('Finished');
    expect(atomic?.hasPdf).toBe(true);
    expect(atomic?.readingTimeMinutes).toBe(12);
    expect(atomic?.summaryId).toBeTruthy();
    expect('pdfData' in (atomic as object)).toBe(false);

    // Asserted before use. If the book failed to migrate at all, this says so
    // outright instead of throwing a TypeError three lines later.
    expect(atomic).toBeDefined();
    const summary = await summaries.getByBook(String(atomic?.id));
    expect(summary?.keyInsights).toEqual(['One', 'Two']);
    expect(summary?.model).toBe('legacy');
  });

  it('moves base64 PDF data into the blob store', async () => {
    seedLegacyLocalStorage();
    await migrateLegacyData();

    const [profile] = await profiles.list();
    const migrated = await books.listByProfile(profile.id);
    const atomic = migrated.find((b) => b.title === 'Atomic Habits');

    expect(atomic).toBeDefined();
    const pdf = await blobs.get(String(atomic?.id), 'pdf');
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
    const migrated = await books.listByProfile(profile.id);
    expect(migrated).toHaveLength(2);
  });

  it('records hasPdf false when the attachment could not be decoded', async () => {
    seedWithOneBadBook();
    await migrateLegacyData();

    const [profile] = await profiles.list();
    const migrated = await books.listByProfile(profile.id);
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

describe('migrateLegacyData with malformed legacy JSON', () => {
  it('denormalises the takeaway onto the Book, not only onto the Summary', async () => {
    seedLegacyLocalStorage();
    await migrateLegacyData();

    const [profile] = await profiles.list();
    const all = await books.listByProfile(profile.id);
    const atomic = all.find((book) => book.title === 'Atomic Habits');

    // The regression this guards: a migrated book carried a summaryId but no
    // oneSentenceTakeaway, so every list view rendered "Not summarised yet"
    // over a book that had a complete summary sitting in the summaries store.
    expect(atomic?.summaryId).toBeDefined();
    expect(atomic?.oneSentenceTakeaway).toBe('Small changes compound.');
  });

  it('leaves a never-summarised book without a summary rather than an empty one', async () => {
    localStorage.setItem(
      `booksum_library_${LEGACY_USER_ID}`,
      JSON.stringify([{ id: 'b', title: 'Unread', author: 'Nobody', status: 'Want to Read' }]),
    );

    const result = await migrateLegacyData();

    const [profile] = await profiles.list();
    const [book] = await books.listByProfile(profile.id);
    // Every legacy book used to get a summaryId plus a Summary made of empty
    // strings, so "has a summary?" answered yes and "what does it say?" answered
    // nothing -- and the AI features that need a summary offered themselves anyway.
    expect(book?.summaryId).toBeUndefined();
    expect(book?.oneSentenceTakeaway).toBeUndefined();
    expect(result.summaries).toBe(0);
    await expect(summaries.listByBook(book.id)).resolves.toHaveLength(0);
  });

  it('survives a profile record that is not an object', async () => {
    localStorage.setItem(`booksum_profile_${LEGACY_USER_ID}`, JSON.stringify('corrupted'));
    localStorage.setItem(
      `booksum_library_${LEGACY_USER_ID}`,
      JSON.stringify([{ id: 'b', title: 'Kept', author: 'Someone' }]),
    );

    const result = await migrateLegacyData();

    // An asserted generic made every field read off this string compile fine and
    // resolve to undefined at runtime; the name fallback is what keeps it usable.
    expect(result.profiles).toBe(1);
    const [profile] = await profiles.list();
    expect(profile?.name).toBe('Reader');
    await expect(books.listByProfile(profile.id)).resolves.toHaveLength(1);
  });

  it('survives a library record that is not an array', async () => {
    localStorage.setItem(`booksum_library_${LEGACY_USER_ID}`, JSON.stringify({ nope: true }));

    const result = await migrateLegacyData();

    // `for...of` over a plain object throws, which used to abort the whole
    // migration for every profile after this one.
    expect(result.migrated).toBe(true);
    expect(result.profiles).toBe(1);
    expect(result.books).toBe(0);
    expect(localStorage.getItem(MIGRATION_MARKER)).not.toBeNull();
  });

  it('imports later profiles even when an earlier one is unreadable', async () => {
    localStorage.setItem(`booksum_library_bad`, '{not json at all');
    localStorage.setItem(
      `booksum_library_good`,
      JSON.stringify([{ id: 'b', title: 'Survivor', author: 'Someone' }]),
    );

    const result = await migrateLegacyData();

    expect(result.profiles).toBe(2);
    const all = (await profiles.list()).map((profile) => profile.id);
    const titles = (await Promise.all(all.map((id) => books.listByProfile(id))))
      .flat()
      .map((book) => book.title);
    expect(titles).toContain('Survivor');
  });

  /**
   * The original app interpolated a missing cover into a URL string, so records
   * carry the literal text 'null'. `<img src="null">` resolves against the
   * page's own directory and the request succeeds enough that onError never
   * fires — the user sees a broken-image icon, not the initials placeholder.
   * Normalising during migration means a library migrated today is clean.
   */
  it.each(['null', 'undefined'])('normalises a stringified %s cover to empty', async (junk) => {
    localStorage.setItem(
      'booksum_db_users',
      JSON.stringify([{ id: LEGACY_USER_ID, name: 'Dorian' }]),
    );
    localStorage.setItem(
      `booksum_library_${LEGACY_USER_ID}`,
      JSON.stringify([
        { id: 'b1', title: 'Atomic Habits', author: 'James Clear', coverImageUrl: junk },
      ]),
    );

    await migrateLegacyData();

    const [profile] = await profiles.list();
    const [book] = await books.listByProfile(profile.id);
    expect(book.coverImageUrl).toBe('');
  });
});
