import type { Book } from '../types';

/**
 * Goodreads writes dates as `YYYY/MM/DD`, which `new Date()` parses as local
 * time; ISO strings parse as UTC. Normalising to an ISO instant here keeps every
 * `finishedAt` in the store comparable, whatever wrote it.
 */
export function parseReadDate(raw: string | undefined): string | undefined {
  if (!raw?.trim()) return undefined;

  const match = raw.trim().match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (match) {
    const [, year, month, day] = match;
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }

  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? undefined : new Date(parsed).toISOString();
}

/** Books finished in the calendar month containing `now`, in local time. */
export function finishedInMonth(books: Book[], now: Date = new Date()): Book[] {
  const year = now.getFullYear();
  const month = now.getMonth();

  return books.filter((book) => {
    if (book.status !== 'Finished' || !book.finishedAt) return false;
    const at = new Date(book.finishedAt);
    if (Number.isNaN(at.getTime())) return false;
    return at.getFullYear() === year && at.getMonth() === month;
  });
}

/**
 * How many books count toward this month's goal. Kept separate from
 * `finishedInMonth` so the "no dates recorded yet" case has one owner: a library
 * migrated or imported before finishedAt was written has finished books with no
 * date, and reporting zero for those would look like data loss.
 */
export function monthlyProgress(
  books: Book[],
  goal: number,
  now: Date = new Date(),
): { finished: number; goal: number; percent: number; undated: number } {
  const safeGoal = goal > 0 ? goal : 1;
  const finished = finishedInMonth(books, now).length;
  const undated = books.filter((b) => b.status === 'Finished' && !b.finishedAt).length;

  return {
    finished,
    goal: safeGoal,
    percent: Math.min(100, Math.round((finished / safeGoal) * 100)),
    undated,
  };
}
