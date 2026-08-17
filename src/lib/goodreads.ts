import type { BookStatus } from '../types';

export interface GoodreadsRow {
  title: string;
  author: string;
  status: BookStatus;
  rating: number;
  isbn13?: string;
  dateRead?: string;
  /**
   * Derived from the `Bookshelves` column. Goodreads shelves are the closest
   * thing the export has to a category, and ignoring them meant every imported
   * book landed as 'Other' — flattening the category filter, the top-genres list
   * and the stats breakdown for anyone whose library came from an import.
   */
  category?: string;
}

export interface GoodreadsParseResult {
  rows: GoodreadsRow[];
  /** Rows present in the file but unusable (no title). */
  skipped: number;
  /** True when the file has no Title column, so it is not a Goodreads export. */
  unrecognised?: boolean;
}

/**
 * Minimal RFC4180 reader: handles quoted fields, doubled quotes inside them,
 * commas and newlines within quotes. Goodreads exports need all of these.
 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

/**
 * Goodreads writes ISBNs as `="9780735211292"` so spreadsheets do not eat the
 * leading zero. Stripping that wrapper is not the same as validating what is
 * left: this is a file the user picked off disk, and whatever came out went
 * unencoded into a cover URL that is persisted on the book and rendered in an
 * `img src`. Only a real ISBN shape gets through now — 10 or 13 digits, with
 * the X check digit ISBN-10 allows.
 */
function cleanIsbn(raw: string | undefined): string | undefined {
  const digits = (raw ?? '')
    .replace(/^="?|"?$/g, '')
    .trim()
    .toUpperCase();
  return /^(\d{9}[\dX]|\d{13})$/.test(digits) ? digits : undefined;
}

function toStatus(shelf: string): BookStatus {
  return shelf.trim().toLowerCase() === 'read' ? 'Finished' : 'Want to Read';
}

export function parseGoodreadsCsv(text: string): GoodreadsParseResult {
  const table = parseCsv(text.trim());
  if (table.length < 2) return { rows: [], skipped: 0 };

  const header = (table[0] ?? []).map((h) => h.trim().toLowerCase());
  /**
   * `undefined` rather than `-1`. As a bare `number` the not-found case was a
   * value the type system could not distinguish from a real column index, and
   * every reader had to remember to check it — one `cells[columnOf('x')]` would
   * have silently read the last column instead of failing.
   */
  const columnOf = (name: string): number | undefined => {
    const at = header.indexOf(name.toLowerCase());
    return at >= 0 ? at : undefined;
  };

  const titleAt = columnOf('title');
  const authorAt = columnOf('author');

  // Without this, any CSV at all parsed to zero rows and reported as an empty
  // library rather than as the wrong file — including a spreadsheet whose first
  // row happens to look like a header.
  if (titleAt === undefined) return { rows: [], skipped: table.length - 1, unrecognised: true };

  const ratingAt = columnOf('my rating');
  const shelfAt = columnOf('exclusive shelf');
  const isbnAt = columnOf('isbn13');
  const dateReadAt = columnOf('date read');
  const shelvesAt = columnOf('bookshelves');

  const rows: GoodreadsRow[] = [];
  let skipped = 0;

  for (const cells of table.slice(1)) {
    const cell = (index: number | undefined) =>
      index === undefined ? '' : (cells[index] ?? '').trim();

    const title = cell(titleAt);
    if (!title) {
      skipped += 1;
      continue;
    }

    const rating = Number.parseInt(cell(ratingAt), 10);
    const dateRead = cell(dateReadAt);

    rows.push({
      title,
      author: cell(authorAt) || 'Unknown',
      status: toStatus(cell(shelfAt)),
      // Clamped, not merely finite. Goodreads writes 0-5, but this is a file the
      // user picked off disk: a hand-edited or non-Goodreads CSV with 99 in that
      // column produced a 99-star book that skewed the library average and drew
      // a row of stars off the end of the card.
      rating: Number.isFinite(rating) ? Math.min(5, Math.max(0, Math.trunc(rating))) : 0,
      isbn13: cleanIsbn(cell(isbnAt)),
      dateRead: dateRead || undefined,
      category: categoryFromShelves(cell(shelvesAt)),
    });
  }

  return { rows, skipped };
}

/**
 * The first meaningful shelf, title-cased, as the book's category.
 *
 * Goodreads writes the reading-state shelves into this column alongside the
 * user's own, so `to-read, philosophy` means the category is Philosophy. Taking
 * the first entry blindly would have categorised half a library as "To Read".
 */
const STATE_SHELVES = new Set(['read', 'to-read', 'currently-reading', 'did-not-finish', 'dnf']);

export function categoryFromShelves(shelves: string): string | undefined {
  for (const raw of shelves.split(',')) {
    const shelf = raw.trim().toLowerCase();
    if (!shelf || STATE_SHELVES.has(shelf)) continue;

    return shelf
      .split(/[-_\s]+/)
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
  return undefined;
}

/**
 * Free cover from an ISBN, when Goodreads gave us one.
 *
 * `?default=false` makes OpenLibrary answer 404 for an ISBN it has no image for,
 * instead of serving a blank 1×1 placeholder with a 200. Without it the image
 * loads "successfully" and `BookCover`'s onError never fires, so an imported
 * library showed rows of empty grey rectangles rather than the generated
 * initials placeholder.
 */
export function coverForIsbn(isbn13: string | undefined): string | undefined {
  return isbn13 ? `https://covers.openlibrary.org/b/isbn/${isbn13}-L.jpg?default=false` : undefined;
}
