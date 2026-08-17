/**
 * @vitest-environment node
 *
 * No DOM here, so this suite skips the jsdom window the default environment
 * builds. See src/test/setup.ts.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { getDb, resetDb } from './db';
import { blobs, books, profiles, reviewCards, summaries } from './repo';
import { isDue, newCard } from '../srs';
import { bookInput } from '../../test/fixtures';

beforeEach(async () => {
  await resetDb();
});

async function seedProfile(name = 'Dorian') {
  return profiles.create({ name });
}

describe('profiles', () => {
  it('creates a profile with defaults and lists it', async () => {
    const created = await seedProfile();
    // Anchored. Unanchored, this passed for any string that merely *contained*
    // 36 hex-or-dash characters — a 200-character blob, or a URL. The id
    // generator has a non-crypto fallback for insecure origins, so the shape it
    // actually emits is worth pinning rather than gesturing at.
    expect(created.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
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

  it('serves the type the kind says, not the one the incoming file claimed', async () => {
    // `type: blob.type` copied a string in from a file the user picked off disk
    // and handed it straight back out on a `blob:` URL — and a blob: URL
    // inherits this page's origin, so that string decides whether the browser
    // renders the bytes as a document or as markup with our privileges.
    const p = await seedProfile();
    const book = await books.create(bookInput(p.id, { hasPdf: true }));

    await blobs.put(book.id, 'pdf', new Blob(['<script>alert(1)</script>'], { type: 'text/html' }));

    const stored = await blobs.get(book.id, 'pdf');
    expect(stored?.type).toBe('application/pdf');
  });

  it('keeps the voice that generated a narration alongside it', async () => {
    // The voice used to ride as a `;voice=Kore` parameter on the stored MIME,
    // so one string was both the cache key and the type the browser renders by.
    // Constraining the second broke the first: the cache regenerated every play.
    const p = await seedProfile();
    const book = await books.create(bookInput(p.id));

    await blobs.put(book.id, 'audio-short', new Blob(['wav bytes']), 'Kore');

    const stored = await blobs.getWithVoice(book.id, 'audio-short');
    expect(stored?.voice).toBe('Kore');
    expect(stored?.blob.type).toBe('audio/wav');
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

describe('reviewCards on their own', () => {
  const card = (profileId: string, bookId: string, question: string) =>
    newCard({
      profileId,
      bookId,
      question,
      options: ['a', 'b'],
      correctAnswerIndex: 0,
      explanation: '',
    });

  it('scopes listByBook to one book', async () => {
    const p = await seedProfile();
    await reviewCards.upsert(card(p.id, 'book-a', 'From A'));
    await reviewCards.upsert(card(p.id, 'book-b', 'From B'));

    const forA = await reviewCards.listByBook('book-a');
    expect(forA.map((c) => c.question)).toEqual(['From A']);
  });

  it('makes a card with an unparseable dueAt due now rather than never', async () => {
    // The by-profile-due index is ordered on dueAt, so a value that is not a
    // timestamp sorts past every real cutoff: the card became invisible to
    // listDue *and* to any "is it due?" check, permanently, with nothing to
    // point at. Falling back to now is the recoverable failure — the user sees
    // it, grades it, and the next write is well-formed.
    const p = await seedProfile();
    const stored = await reviewCards.upsert({ ...card(p.id, 'b1', 'Broken'), dueAt: 'someday' });

    expect(Number.isNaN(Date.parse(stored.dueAt))).toBe(false);
    const due = await reviewCards.listDue(p.id, new Date(Date.now() + 1000));
    expect(due.map((c) => c.question)).toEqual(['Broken']);
  });

  it('replaces a card on upsert rather than storing it twice', async () => {
    const p = await seedProfile();
    const first = await reviewCards.upsert(card(p.id, 'b1', 'Same card'));
    await reviewCards.upsert({ ...first, reviewCount: 3 });

    const all = await reviewCards.listByProfile(p.id);
    expect(all).toHaveLength(1);
    expect(all[0]?.reviewCount).toBe(3);
  });
});

describe('cascades when there is nothing to cascade', () => {
  it('removes a book that has no summary, blob or card', async () => {
    const p = await seedProfile();
    const book = await books.create(bookInput(p.id));

    await expect(books.remove(book.id)).resolves.toBeUndefined();
    await expect(books.get(book.id)).resolves.toBeUndefined();
  });

  it('treats removing a book that does not exist as a no-op', async () => {
    // Reachable for real: two tabs open on the same library, both showing the
    // same book, and the second delete arrives after the first has landed.
    await expect(books.remove('never-existed')).resolves.toBeUndefined();
  });

  it('removes a profile that owns no books', async () => {
    const p = await seedProfile('Empty');
    await expect(profiles.remove(p.id)).resolves.toBeUndefined();
    await expect(profiles.list()).resolves.toEqual([]);
  });

  it('reports no books cleared for a profile with an empty library', async () => {
    const p = await seedProfile();
    await expect(books.removeAllForProfile(p.id)).resolves.toBe(0);
  });
});

describe('the two ways a card can be "due"', () => {
  it('agrees between isDue and listDue for awkward timestamps', async () => {
    // `isDue` parses dueAt and compares numerically. `listDue` compares it
    // lexically, because it is an IndexedDB index range. Those two agree only
    // if every stored dueAt is fixed-width UTC ISO — an offset timestamp like
    // "+02:00" parses correctly and sorts wrongly, so a card could be due by
    // one measure and invisible by the other. upsert canonicalises on write;
    // this asserts the two actually agree rather than assuming they do.
    const p = await seedProfile();
    const book = await books.create(bookInput(p.id));
    const now = new Date('2026-08-17T12:00:00.000Z');

    const dueAts = [
      '2026-08-17T10:00:00.000Z', // plainly past
      '2026-08-17T14:00:00.000Z', // plainly future
      '2026-08-17T13:00:00+02:00', // past in UTC (11:00Z), future-looking as text
      '2026-08-17T11:00:00-02:00', // future in UTC (13:00Z), past-looking as text
      '2026-08-17T12:00:00.000Z', // exactly now — due
      'not a date at all', // unparseable — normalised to write time
      '999-01-01T00:00:00.000Z', // short year, sorts before everything
    ];

    for (const [index, dueAt] of dueAts.entries()) {
      await reviewCards.upsert({
        ...newCard({
          profileId: p.id,
          bookId: book.id,
          question: `q${index}`,
          options: ['a', 'b', 'c', 'd'],
          correctAnswerIndex: 0,
          explanation: 'because',
        }),
        id: `card-${index}`,
        dueAt,
      });
    }

    const stored = await reviewCards.listByBook(book.id);
    expect(stored).toHaveLength(dueAts.length);

    const byIndexQuery = (await reviewCards.listDue(p.id, now)).map((c) => c.id).sort();
    const byPredicate = stored
      .filter((c) => isDue(c, now))
      .map((c) => c.id)
      .sort();

    expect(byIndexQuery).toEqual(byPredicate);
  });
});

describe('numbers that arrive broken', () => {
  it('does not persist NaN as a monthly goal', async () => {
    // The goal field is a number input read with parseInt, which gives NaN for
    // an empty box. NaN satisfies `number`, so it stored cleanly and then
    // poisoned every read — the goal ring divided by it and rendered NaN%.
    const p = await seedProfile();
    const saved = await profiles.update({ ...p, monthlyGoal: Number.NaN });

    expect(saved.monthlyGoal).toBe(4);
    await expect(profiles.get(p.id)).resolves.toMatchObject({ monthlyGoal: 4 });
  });

  it.each([
    ['NaN', Number.NaN, 0],
    ['above the scale', 99, 5],
    ['negative', -3, 0],
    ['fractional', 3.7, 4],
  ])('clamps a %s rating on write', async (_label, given, expected) => {
    const p = await seedProfile();
    const book = await books.create(bookInput(p.id));

    const saved = await books.update({ ...book, rating: given });

    expect(saved.rating).toBe(expected);
    await expect(books.get(book.id)).resolves.toMatchObject({ rating: expected });
  });
});

describe('methods that take different kinds of id but the same type', () => {
  it('returns nothing when a bookId is passed where a profileId belongs, and vice versa', async () => {
    // reviewCards.listByProfile and reviewCards.listByBook sit twenty lines
    // apart with the identical signature `(string) => Promise<ReviewCard[]>`.
    // Swapping them compiles and returns [], which every caller reads as
    // "nothing due" rather than as the mistake it is.
    //
    // Branding the id types would catch this at compile time; measured at 82
    // errors, 64 of them casts in fixtures, which is not worth it for a library
    // this size. This asserts the same distinction behaviourally instead: if
    // the two lookups ever start answering each other's questions, it fails.
    const p = await seedProfile();
    const book = await books.create(bookInput(p.id));
    await reviewCards.upsert(
      newCard({
        profileId: p.id,
        bookId: book.id,
        question: 'q',
        options: ['a', 'b', 'c', 'd'],
        correctAnswerIndex: 0,
        explanation: 'e',
      }),
    );

    await expect(reviewCards.listByProfile(p.id)).resolves.toHaveLength(1);
    await expect(reviewCards.listByBook(book.id)).resolves.toHaveLength(1);

    // The swap.
    await expect(reviewCards.listByProfile(book.id)).resolves.toHaveLength(0);
    await expect(reviewCards.listByBook(p.id)).resolves.toHaveLength(0);
  });
});
