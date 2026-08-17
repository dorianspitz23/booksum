/**
 * @vitest-environment node
 *
 * No DOM here, so this suite skips the jsdom window the default environment
 * builds. See src/test/setup.ts.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { getDb, resetDb } from './db';
import { blobs, books, profiles, reviewCards, summaries } from './repo';
import { newCard } from '../srs';

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

  it('reports nothing stored rather than building a Blob out of a corrupt record', async () => {
    // `new Blob([x])` accepts anything and stringifies what it does not
    // recognise, so a record whose `bytes` is not an ArrayBuffer used to come
    // back as a readable-looking PDF full of "[object Object]". The reader then
    // showed garbage with no error anywhere. Undefined puts the caller on the
    // "no PDF stored" path it already handles.
    const p = await seedProfile();
    const book = await books.create(bookInput(p.id));

    const db = await getDb();
    await db.put('blobs', {
      key: `${book.id}:pdf`,
      bookId: book.id,
      kind: 'pdf',
      bytes: { not: 'an ArrayBuffer' } as unknown as ArrayBuffer,
      type: 'application/pdf',
    });

    await expect(blobs.get(book.id, 'pdf')).resolves.toBeUndefined();
  });
});

describe('reading records an older build wrote', () => {
  it('lists a profile that has no createdAt instead of failing to render any', async () => {
    // profiles.list sorted with `a.createdAt.localeCompare(...)`, a string method
    // on a field the schema declares and nothing enforces. This is the first read
    // of the session, so one undated row did not degrade the picker — it threw
    // before the picker existed, leaving no profiles and no way into the app.
    const dated = await profiles.create({ name: 'Has a date' });

    const db = await getDb();
    const undated: Record<string, unknown> = { ...dated, id: 'legacy-row', name: 'No date' };
    delete undated.createdAt;
    await db.put('profiles', undated as unknown as typeof dated);

    const listed = await profiles.list();
    expect(listed.map((p) => p.name)).toEqual(['No date', 'Has a date']);
  });
});

/**
 * The cascades used to span four (book) and N+1 (profile) independent
 * transactions, so a failure part-way through left orphaned rows keyed to
 * something that no longer existed. They are now one transaction each.
 */
describe('cascading deletes are complete', () => {
  async function seedFullBook() {
    const profile = await seedProfile();
    const book = await books.create(bookInput(profile.id));
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
    await blobs.put(book.id, 'pdf', new Blob(['pdf']));
    await blobs.put(book.id, 'audio-short', new Blob(['wav']));
    await reviewCards.upsert(
      newCard({
        profileId: profile.id,
        bookId: book.id,
        question: 'Q?',
        options: ['a', 'b'],
        correctAnswerIndex: 0,
        explanation: 'because',
      }),
    );
    return { profile, book };
  }

  it('removing a book takes its review cards with it', async () => {
    const { book } = await seedFullBook();
    await books.remove(book.id);
    await expect(reviewCards.listByBook(book.id)).resolves.toHaveLength(0);
  });

  it('removing a book takes every blob kind, not just the pdf', async () => {
    const { book } = await seedFullBook();
    await books.remove(book.id);
    await expect(blobs.get(book.id, 'pdf')).resolves.toBeUndefined();
    await expect(blobs.get(book.id, 'audio-short')).resolves.toBeUndefined();
  });

  it('removing a book deletes every summary row it carries, not only the first', async () => {
    const { book } = await seedFullBook();
    // A second row is what importing a backup over an existing library produced.
    await summaries.upsert({
      id: 'sum-2',
      bookId: book.id,
      oneSentenceTakeaway: 'duplicate',
      summary: 'duplicate',
      keyInsights: [],
      actionableSteps: [],
      generatedAt: new Date().toISOString(),
      model: 'test',
    });
    await expect(summaries.listByBook(book.id)).resolves.toHaveLength(2);

    await books.remove(book.id);

    await expect(summaries.listByBook(book.id)).resolves.toHaveLength(0);
  });

  it('removing a profile takes its review cards with it', async () => {
    const { profile, book } = await seedFullBook();

    await profiles.remove(profile.id);

    await expect(profiles.get(profile.id)).resolves.toBeUndefined();
    await expect(books.listByProfile(profile.id)).resolves.toHaveLength(0);
    await expect(reviewCards.listByProfile(profile.id)).resolves.toHaveLength(0);
    await expect(summaries.listByBook(book.id)).resolves.toHaveLength(0);
    await expect(blobs.get(book.id, 'pdf')).resolves.toBeUndefined();
  });

  it('leaves another profile untouched', async () => {
    const { profile } = await seedFullBook();
    const other = await seedProfile('Someone else');
    const theirs = await books.create(bookInput(other.id, { title: 'Deep Work' }));

    await profiles.remove(profile.id);

    await expect(books.listByProfile(other.id)).resolves.toHaveLength(1);
    await expect(books.get(theirs.id)).resolves.toBeDefined();
  });
});

describe('reviewCards index-backed lookups', () => {
  const card = (profileId: string, question: string) =>
    newCard({
      profileId,
      bookId: 'b1',
      question,
      options: ['a', 'b'],
      correctAnswerIndex: 0,
      explanation: '',
    });

  it('scopes listByProfile to one profile', async () => {
    const mine = await seedProfile('Mine');
    const other = await seedProfile('Other');
    await reviewCards.upsert(card(mine.id, 'Mine'));
    await reviewCards.upsert(card(other.id, 'Theirs'));

    const found = await reviewCards.listByProfile(mine.id);
    expect(found).toHaveLength(1);
    expect(found[0]?.question).toBe('Mine');
  });

  it('returns only cards already due, at the boundary', async () => {
    const profile = await seedProfile();
    const at = (dueAt: string, question: string) =>
      reviewCards.upsert({ ...card(profile.id, question), dueAt });

    const now = new Date('2026-06-15T12:00:00.000Z');
    await at('2026-06-15T11:59:59.999Z', 'past');
    await at('2026-06-15T12:00:00.000Z', 'exactly now');
    await at('2026-06-15T12:00:00.001Z', 'future');

    const due = await reviewCards.listDue(profile.id, now);
    expect(due.map((c) => c.question).sort()).toEqual(['exactly now', 'past']);
  });
});
