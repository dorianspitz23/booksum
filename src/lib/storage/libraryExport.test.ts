/**
 * @vitest-environment node
 *
 * No DOM here, so this suite skips the jsdom window the default environment
 * builds. See src/test/setup.ts.
 */
import { describe, expect, it } from 'vitest';
import { parseLibraryExport } from './libraryExport';
import type { Book, Summary } from '../../types';

const book: Book = {
  id: 'book-1',
  profileId: 'profile-1',
  title: 'Atomic Habits',
  author: 'James Clear',
  category: 'Productivity',
  status: 'Finished',
  rating: 5,
  coverImageUrl: '',
  addedAt: '2026-01-01T00:00:00.000Z',
  readingTimeMinutes: 12,
  hasPdf: false,
};

const summary: Summary = {
  id: 'summary-1',
  bookId: 'book-1',
  oneSentenceTakeaway: 'Small changes compound.',
  summary: 'A book about habits.',
  keyInsights: ['Start small.'],
  actionableSteps: ['Do one push-up.'],
  generatedAt: '2026-01-01T00:00:00.000Z',
  model: 'test',
};

const validExport = {
  version: 2,
  exportedAt: '2026-01-01T00:00:00.000Z',
  books: [book],
  summaries: [summary],
};

describe('parseLibraryExport', () => {
  it('accepts a well-formed v2 backup', () => {
    const result = parseLibraryExport(validExport);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.books).toHaveLength(1);
    expect(result.data.summaries).toHaveLength(1);
  });

  it.each([
    ['null', null],
    ['a string', 'not an object'],
    ['an array', []],
    ['an empty object', {}],
    ['a number', 42],
  ])('rejects %s', (_label, value) => {
    expect(parseLibraryExport(value).ok).toBe(false);
  });

  it('rejects a payload whose books field is not an array', () => {
    expect(parseLibraryExport({ ...validExport, books: 'nope' }).ok).toBe(false);
  });

  /**
   * The original app (commit 670b5fe) shipped a v1 export carrying `pdfData` and
   * `audioData` as inline base64 on every book. Importing one of those today
   * would write binary straight onto Book records, which is the exact thing that
   * broke the original app.
   */
  it('rejects a v1 backup rather than importing its inline binary', () => {
    const v1 = {
      version: 1,
      timestamp: '2026-01-01T00:00:00.000Z',
      profile: { name: 'Dorian' },
      books: [{ ...book, pdfData: 'AAAA', audioData: 'BBBB', summary: 'inline' }],
    };

    const result = parseLibraryExport(v1);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/version/i);
  });

  it('strips keys that are not part of Book, so binary cannot ride along', () => {
    const smuggled = {
      ...validExport,
      books: [{ ...book, pdfData: 'AAAA', audioData: 'BBBB' }],
    };

    const result = parseLibraryExport(smuggled);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.books[0]).not.toHaveProperty('pdfData');
    expect(result.data.books[0]).not.toHaveProperty('audioData');
  });

  it('drops a book that is missing a required field instead of persisting it', () => {
    const result = parseLibraryExport({
      ...validExport,
      books: [book, { id: 'broken' }],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.books).toHaveLength(1);
    expect(result.skipped).toBe(1);
  });

  it('drops a book whose required field is the wrong type', () => {
    const result = parseLibraryExport({
      ...validExport,
      books: [{ ...book, title: 42 }],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.books).toHaveLength(0);
    expect(result.skipped).toBe(1);
  });

  it('drops a summary whose array fields are not arrays of strings', () => {
    const result = parseLibraryExport({
      ...validExport,
      summaries: [{ ...summary, keyInsights: 'not an array' }],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.summaries).toHaveLength(0);
  });

  it('tolerates a backup with no summaries key at all', () => {
    const result = parseLibraryExport({
      version: 2,
      exportedAt: '2026-01-01T00:00:00.000Z',
      books: [book],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.summaries).toEqual([]);
  });
});

describe('parseLibraryExport across versions', () => {
  const card = {
    id: 'card-1',
    profileId: 'profile-1',
    bookId: 'book-1',
    question: 'Q?',
    options: ['a', 'b', 'c', 'd'],
    correctAnswerIndex: 1,
    explanation: 'because',
    ease: 2.5,
    intervalDays: 3,
    dueAt: '2026-08-01T00:00:00.000Z',
    reviewCount: 2,
  };

  it('still accepts a v2 backup, which has neither new field', () => {
    // Refusing these would break every backup already sitting on someone's disk.
    const result = parseLibraryExport({ version: 2, books: [book], summaries: [summary] });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.books).toHaveLength(1);
    expect(result.data.reviewCards).toEqual([]);
    expect(result.data.profile).toBeUndefined();
  });

  it('carries review cards and profile settings out of a v3 backup', () => {
    const result = parseLibraryExport({
      version: 3,
      books: [book],
      summaries: [summary],
      reviewCards: [card],
      profile: {
        name: 'Dorian',
        bio: 'Reader',
        monthlyGoal: 6,
        favoriteVoice: 'Puck',
        theme: 'dark',
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.reviewCards).toHaveLength(1);
    expect(result.data.profile?.favoriteVoice).toBe('Puck');
    expect(result.data.profile?.theme).toBe('dark');
  });

  it('rejects a card that cannot be answered rather than persisting it', () => {
    const result = parseLibraryExport({
      version: 3,
      books: [],
      summaries: [],
      reviewCards: [
        { ...card, id: 'c1', options: [] }, // deadlocked the review session
        { ...card, id: 'c2', correctAnswerIndex: 9 }, // scored every answer wrong
        { ...card, id: 'c3', dueAt: 'not a date' }, // unreachable through the index
        card,
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.reviewCards).toHaveLength(1);
    expect(result.data.reviewCards?.[0]?.id).toBe('card-1');
    expect(result.skipped).toBe(3);
  });

  it('falls back to safe defaults for unknown voices and themes', () => {
    const result = parseLibraryExport({
      version: 3,
      books: [],
      summaries: [],
      profile: { name: 'Dorian', favoriteVoice: 'NotAVoice', theme: 'neon' },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Otherwise this would be written straight onto the profile and handed to
    // the TTS API as a voice name.
    expect(result.data.profile?.favoriteVoice).toBe('Kore');
    expect(result.data.profile?.theme).toBe('system');
  });

  it('rejects a version it cannot read, and says which it can', () => {
    const result = parseLibraryExport({ version: 99, books: [] });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain('2 and 3');
  });
});
