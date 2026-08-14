/**
 * @vitest-environment node
 *
 * No DOM here, so this suite skips the jsdom window the default environment
 * builds. See src/test/setup.ts.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from './db';
import { blobs, books, profiles, summaries } from './repo';

beforeEach(async () => {
  await resetDb();
});

async function seedProfile(name = 'Dorian') {
  return profiles.create({ name });
}

function bookInput(profileId: string, overrides: Partial<Parameters<typeof books.create>[0]> = {}) {
  return {
    profileId,
    title: 'Atomic Habits',
    author: 'James Clear',
    category: 'Productivity',
    status: 'Finished' as const,
    rating: 5,
    readingTimeMinutes: 12,
    coverImageUrl: 'https://example.test/cover.jpg',
    hasPdf: false,
    ...overrides,
  };
}

describe('profiles', () => {
  it('creates a profile with defaults and lists it', async () => {
    const created = await seedProfile();
    expect(created.id).toMatch(/[0-9a-f-]{36}/);
    expect(created.monthlyGoal).toBe(4);
    expect(created.favoriteVoice).toBe('Kore');
    expect(created.theme).toBe('system');
    await expect(profiles.list()).resolves.toHaveLength(1);
  });

  it('updates a profile', async () => {
    const p = await seedProfile();
    await profiles.update({ ...p, monthlyGoal: 10 });
    await expect(profiles.get(p.id)).resolves.toMatchObject({ monthlyGoal: 10 });
  });
});

describe('books', () => {
  it('scopes books to their profile', async () => {
    const a = await seedProfile('A');
    const b = await seedProfile('B');
    await books.create(bookInput(a.id));
    await books.create(bookInput(b.id, { title: 'Deep Work' }));

    const forA = await books.listByProfile(a.id);
    expect(forA).toHaveLength(1);
    expect(forA[0]?.title).toBe('Atomic Habits');
  });

  it('assigns an id and addedAt on create', async () => {
    const p = await seedProfile();
    const book = await books.create(bookInput(p.id));
    expect(book.id).toBeTruthy();
    expect(Date.parse(book.addedAt)).not.toBeNaN();
  });
});

describe('cascading deletes', () => {
  it('removes the summary and blobs when a book is removed', async () => {
    const p = await seedProfile();
    const book = await books.create(bookInput(p.id));
    await summaries.upsert({
      id: 'sum-1',
      bookId: book.id,
      oneSentenceTakeaway: 'x',
      summary: 'y',
      keyInsights: [],
      actionableSteps: [],
      generatedAt: new Date().toISOString(),
      model: 'test',
    });
    await blobs.put(book.id, 'pdf', new Blob(['pdf bytes'], { type: 'application/pdf' }));

    await books.remove(book.id);

    await expect(books.get(book.id)).resolves.toBeUndefined();
    await expect(summaries.getByBook(book.id)).resolves.toBeUndefined();
    await expect(blobs.get(book.id, 'pdf')).resolves.toBeUndefined();
  });

  it('removes every book, summary and blob when a profile is removed', async () => {
    const p = await seedProfile();
    const book = await books.create(bookInput(p.id));
    await blobs.put(book.id, 'pdf', new Blob(['x']));

    await profiles.remove(p.id);

    await expect(books.listByProfile(p.id)).resolves.toHaveLength(0);
    await expect(blobs.get(book.id, 'pdf')).resolves.toBeUndefined();
  });
});

describe('blobs', () => {
  it('round-trips a blob without inflating the book record', async () => {
    const p = await seedProfile();
    const book = await books.create(bookInput(p.id, { hasPdf: true }));
    const bytes = new Uint8Array(5 * 1024 * 1024);
    await blobs.put(book.id, 'pdf', new Blob([bytes], { type: 'application/pdf' }));

    const stored = await blobs.get(book.id, 'pdf');
    expect(stored?.size).toBe(bytes.byteLength);

    const reloaded = await books.get(book.id);
    expect(JSON.stringify(reloaded).length).toBeLessThan(1_000);
  });

  it('overwrites a blob of the same kind rather than duplicating it', async () => {
    const p = await seedProfile();
    const book = await books.create(bookInput(p.id));
    await blobs.put(book.id, 'audio-short', new Blob(['one']));
    await blobs.put(book.id, 'audio-short', new Blob(['two-longer']));

    const stored = await blobs.get(book.id, 'audio-short');
    expect(await stored?.text()).toBe('two-longer');
  });
});
