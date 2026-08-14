import { describe, expect, it } from 'vitest';
import { finishedInMonth, monthlyProgress, parseReadDate } from './stats';
import type { Book } from '../types';

const book = (overrides: Partial<Book> = {}): Book => ({
  id: 'b1',
  profileId: 'p1',
  title: 'Atomic Habits',
  author: 'James Clear',
  category: 'Productivity',
  status: 'Finished',
  rating: 5,
  coverImageUrl: '',
  addedAt: '2026-01-01T00:00:00.000Z',
  readingTimeMinutes: 12,
  hasPdf: false,
  ...overrides,
});

describe('parseReadDate', () => {
  it('reads the Goodreads YYYY/MM/DD format', () => {
    expect(parseReadDate('2026/03/14')).toBe('2026-03-14T00:00:00.000Z');
  });

  it('reads a single-digit month and day', () => {
    expect(parseReadDate('2026/3/4')).toBe('2026-03-04T00:00:00.000Z');
  });

  it('reads an ISO string', () => {
    expect(parseReadDate('2026-03-14T09:30:00.000Z')).toBe('2026-03-14T09:30:00.000Z');
  });

  it('returns undefined for blank or unparseable input', () => {
    expect(parseReadDate(undefined)).toBeUndefined();
    expect(parseReadDate('')).toBeUndefined();
    expect(parseReadDate('   ')).toBeUndefined();
    expect(parseReadDate('not a date')).toBeUndefined();
  });

  it('does not shift the day across a timezone', () => {
    // Parsed as local time, 2026/01/01 becomes 2025-12-31 for anyone west of UTC.
    expect(parseReadDate('2026/01/01')).toBe('2026-01-01T00:00:00.000Z');
  });
});

describe('finishedInMonth', () => {
  const now = new Date(2026, 2, 20); // 20 March 2026, local

  it('counts a book finished in the same calendar month', () => {
    const books = [book({ finishedAt: new Date(2026, 2, 3).toISOString() })];
    expect(finishedInMonth(books, now)).toHaveLength(1);
  });

  it('excludes last month', () => {
    const books = [book({ finishedAt: new Date(2026, 1, 27).toISOString() })];
    expect(finishedInMonth(books, now)).toHaveLength(0);
  });

  it('excludes the same month a year earlier', () => {
    const books = [book({ finishedAt: new Date(2025, 2, 20).toISOString() })];
    expect(finishedInMonth(books, now)).toHaveLength(0);
  });

  it('excludes books that are finished but carry no date', () => {
    expect(finishedInMonth([book({ finishedAt: undefined })], now)).toHaveLength(0);
  });

  it('excludes a book still on the queue even if it has a date', () => {
    const books = [
      book({ status: 'Want to Read', finishedAt: new Date(2026, 2, 3).toISOString() }),
    ];
    expect(finishedInMonth(books, now)).toHaveLength(0);
  });

  it('ignores an unparseable finishedAt rather than throwing', () => {
    expect(finishedInMonth([book({ finishedAt: 'garbage' })], now)).toHaveLength(0);
  });
});

describe('monthlyProgress', () => {
  const now = new Date(2026, 2, 20);

  it('reports progress against the goal', () => {
    const books = [
      book({ id: 'a', finishedAt: new Date(2026, 2, 1).toISOString() }),
      book({ id: 'b', finishedAt: new Date(2026, 2, 9).toISOString() }),
    ];
    expect(monthlyProgress(books, 4, now)).toMatchObject({ finished: 2, goal: 4, percent: 50 });
  });

  it('clamps at 100 percent', () => {
    const books = Array.from({ length: 9 }, (_, i) =>
      book({ id: `b${i}`, finishedAt: new Date(2026, 2, 2).toISOString() }),
    );
    expect(monthlyProgress(books, 4, now).percent).toBe(100);
  });

  it('does not divide by a zero goal', () => {
    // A migrated legacy profile can carry monthlyGoal 0, which used to render
    // Infinity and clamp to a permanent 100%.
    expect(monthlyProgress([], 0, now)).toMatchObject({ goal: 1, percent: 0 });
  });

  it('counts finished books with no date separately rather than silently dropping them', () => {
    const books = [
      book({ id: 'a', finishedAt: new Date(2026, 2, 1).toISOString() }),
      book({ id: 'b', finishedAt: undefined }),
      book({ id: 'c', finishedAt: undefined }),
    ];
    expect(monthlyProgress(books, 4, now)).toMatchObject({ finished: 1, undated: 2 });
  });
});
