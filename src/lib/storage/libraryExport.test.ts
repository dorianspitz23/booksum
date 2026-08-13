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
