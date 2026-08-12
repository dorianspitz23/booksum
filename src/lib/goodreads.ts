import type { BookStatus } from '../types';

export interface GoodreadsRow {
  title: string;
  author: string;
  status: BookStatus;
  rating: number;
  isbn13?: string;
  dateRead?: string;
}

export interface GoodreadsParseResult {
  rows: GoodreadsRow[];
  /** Rows present in the file but unusable (no title). */
  skipped: number;
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

/** Goodreads writes ISBNs as `="9780735211292"` to stop spreadsheets mangling them. */
function cleanIsbn(raw: string | undefined): string | undefined {
  const digits = (raw ?? '').replace(/^="?|"?$/g, '').trim();
  return digits.length > 0 ? digits : undefined;
}

function toStatus(shelf: string): BookStatus {
  return shelf.trim().toLowerCase() === 'read' ? 'Finished' : 'Want to Read';
}

export function parseGoodreadsCsv(text: string): GoodreadsParseResult {
  const table = parseCsv(text.trim());
  if (table.length < 2) return { rows: [], skipped: 0 };

  const header = (table[0] ?? []).map((h) => h.trim().toLowerCase());
  const columnOf = (name: string) => header.indexOf(name.toLowerCase());

  const titleAt = columnOf('title');
  const authorAt = columnOf('author');
  const ratingAt = columnOf('my rating');
  const shelfAt = columnOf('exclusive shelf');
  const isbnAt = columnOf('isbn13');
  const dateReadAt = columnOf('date read');

  const rows: GoodreadsRow[] = [];
  let skipped = 0;

  for (const cells of table.slice(1)) {
    const cell = (index: number) => (index >= 0 ? (cells[index] ?? '').trim() : '');

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
      rating: Number.isFinite(rating) ? rating : 0,
      isbn13: cleanIsbn(cell(isbnAt)),
      dateRead: dateRead || undefined,
    });
  }

  return { rows, skipped };
}

/** Free cover from an ISBN, when Goodreads gave us one. */
export function coverForIsbn(isbn13: string | undefined): string | undefined {
  return isbn13 ? `https://covers.openlibrary.org/b/isbn/${isbn13}-L.jpg` : undefined;
}
