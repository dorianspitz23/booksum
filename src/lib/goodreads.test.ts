/**
 * @vitest-environment node
 *
 * No DOM here, so this suite skips the jsdom window the default environment
 * builds. See src/test/setup.ts.
 */
import { describe, expect, it } from 'vitest';
import { coverForIsbn, parseGoodreadsCsv } from './goodreads';

const HEADER = 'Book Id,Title,Author,My Rating,Exclusive Shelf,ISBN13,Date Read';

function csv(...rows: string[]) {
  return [HEADER, ...rows].join('\n');
}

describe('parseGoodreadsCsv', () => {
  it('parses a simple row', () => {
    const { rows } = parseGoodreadsCsv(
      csv('123,Atomic Habits,James Clear,5,read,="9780735211292",2026/02/01'),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      title: 'Atomic Habits',
      author: 'James Clear',
      rating: 5,
      status: 'Finished',
      isbn13: '9780735211292',
      dateRead: '2026/02/01',
    });
  });

  it('maps to-read to Want to Read', () => {
    const { rows } = parseGoodreadsCsv(csv('1,Deep Work,Cal Newport,0,to-read,="",'));
    expect(rows[0]?.status).toBe('Want to Read');
  });

  it('treats currently-reading as Want to Read', () => {
    const { rows } = parseGoodreadsCsv(csv('1,Sapiens,Harari,0,currently-reading,="",'));
    expect(rows[0]?.status).toBe('Want to Read');
  });

  it('handles quoted fields containing commas', () => {
    const { rows } = parseGoodreadsCsv(
      csv('1,"Sapiens: A Brief History, Illustrated",Harari,4,read,="",'),
    );
    expect(rows[0]?.title).toBe('Sapiens: A Brief History, Illustrated');
  });

  it('handles escaped double quotes inside a quoted field', () => {
    const { rows } = parseGoodreadsCsv(csv('1,"The ""Good"" Book",Someone,3,read,="",'));
    expect(rows[0]?.title).toBe('The "Good" Book');
  });

  it('strips the Goodreads ="..." ISBN wrapper and drops empties', () => {
    const { rows } = parseGoodreadsCsv(csv('1,X,Y,0,to-read,="",'));
    expect(rows[0]?.isbn13).toBeUndefined();
  });

  it('skips rows with no title and reports the count', () => {
    const { rows, skipped } = parseGoodreadsCsv(
      csv('1,,No Title,0,read,="",', '2,Real,A,1,read,="",'),
    );
    expect(rows).toHaveLength(1);
    expect(skipped).toBe(1);
  });

  it('returns nothing for an empty or header-only file', () => {
    expect(parseGoodreadsCsv('').rows).toHaveLength(0);
    expect(parseGoodreadsCsv(HEADER).rows).toHaveLength(0);
  });

  it('tolerates a missing optional column', () => {
    const { rows } = parseGoodreadsCsv('Title,Author,Exclusive Shelf\nDune,Herbert,read');
    expect(rows[0]).toMatchObject({ title: 'Dune', author: 'Herbert', status: 'Finished' });
    expect(rows[0]?.rating).toBe(0);
  });

  it('does not care about column order', () => {
    const { rows } = parseGoodreadsCsv('Exclusive Shelf,Author,Title\nread,Clear,Atomic Habits');
    expect(rows[0]).toMatchObject({ title: 'Atomic Habits', author: 'Clear', status: 'Finished' });
  });

  it('falls back to Unknown for a missing author', () => {
    const { rows } = parseGoodreadsCsv(csv('1,Untitled Author Book,,0,read,="",'));
    expect(rows[0]?.author).toBe('Unknown');
  });

  it('handles CRLF line endings', () => {
    const { rows } = parseGoodreadsCsv(`${HEADER}\r\n1,Dune,Herbert,4,read,="",\r\n`);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.title).toBe('Dune');
  });

  it('handles a newline inside a quoted field', () => {
    const { rows } = parseGoodreadsCsv(csv('1,"Line one\nLine two",A,3,read,="",'));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.title).toBe('Line one\nLine two');
  });
});

describe('a rating column that is not a Goodreads rating', () => {
  // Only checked for finiteness before, so the number went through unchanged.
  // This is a file the user picks off disk — a hand-edited export, or a CSV
  // from somewhere else that happens to have a "My Rating" column — and a
  // 99-star book skewed the library average and drew stars off the card.
  it.each([
    ['99', 5],
    ['-3', 0],
    ['4.8', 4],
    ['not a number', 0],
    ['', 0],
  ])('clamps %s to %i', (cell, expected) => {
    const { rows } = parseGoodreadsCsv(csv(`1,Atomic Habits,James Clear,${cell},read,,`));
    expect(rows[0]?.rating).toBe(expected);
  });
});

describe('categories from shelves', () => {
  const withShelves = (shelves: string) =>
    parseGoodreadsCsv(
      [
        'Title,Author,Exclusive Shelf,Bookshelves',
        `Atomic Habits,James Clear,read,"${shelves}"`,
      ].join('\n'),
    ).rows[0];

  it('uses the first shelf that is not a reading state', () => {
    // Goodreads writes the state shelves into this column alongside the user's
    // own, so taking the first entry blindly would categorise half a library
    // as "To Read".
    expect(withShelves('to-read, philosophy')?.category).toBe('Philosophy');
    expect(withShelves('read, currently-reading, personal-finance')?.category).toBe(
      'Personal Finance',
    );
  });

  it('title-cases a hyphenated shelf', () => {
    expect(withShelves('science-fiction')?.category).toBe('Science Fiction');
  });

  it('leaves the category unset when there is nothing but state shelves', () => {
    // Falls back to 'Other' at the import site rather than inventing one here.
    expect(withShelves('read, to-read')?.category).toBeUndefined();
    expect(withShelves('')?.category).toBeUndefined();
  });

  it('is absent when the export has no Bookshelves column at all', () => {
    const parsed = parseGoodreadsCsv(
      ['Title,Author,Exclusive Shelf', 'Atomic Habits,James Clear,read'].join('\n'),
    );
    expect(parsed.rows[0]?.category).toBeUndefined();
    expect(parsed.unrecognised).toBeFalsy();
  });
});

describe('rejecting a file that is not a Goodreads export', () => {
  it('flags a CSV with no Title column', () => {
    // This used to parse to zero rows and report as an empty library, sending
    // the user hunting for missing books rather than for the right file.
    const parsed = parseGoodreadsCsv(['Name,Amount', 'Coffee,3.50'].join('\n'));

    expect(parsed.unrecognised).toBe(true);
    expect(parsed.rows).toHaveLength(0);
  });

  it('does not flag a real export', () => {
    const parsed = parseGoodreadsCsv(
      ['Title,Author,Exclusive Shelf', 'Atomic Habits,James Clear,read'].join('\n'),
    );

    expect(parsed.unrecognised).toBeFalsy();
    expect(parsed.rows).toHaveLength(1);
  });
});

/**
 * Calibre and StoryGraph both write a `title` column, so both clear the
 * not-a-Goodreads-export guard and import — and then every other column name
 * differs, so before this each book arrived as 'Unknown' / 'Want to Read' / 0
 * stars behind a preview reporting success.
 */
describe('exports from other libraries', () => {
  // Calibre's default CSV catalog columns.
  const CALIBRE = 'title,authors,series,series_index,isbn,publisher,pubdate,rating,tags';
  const calibre = (row: string) => parseGoodreadsCsv([CALIBRE, row].join('\n'));

  it('reads a Calibre author from the plural column', () => {
    const { rows } = calibre('Dune,Frank Herbert,,,9780441013593,Ace,2005,4,sci-fi');
    expect(rows[0]?.author).toBe('Frank Herbert');
  });

  it('reads a Calibre rating and ISBN', () => {
    const { rows } = calibre('Dune,Frank Herbert,,,9780441013593,Ace,2005,4,sci-fi');
    expect(rows[0]?.rating).toBe(4);
    expect(rows[0]?.isbn13).toBe('9780441013593');
  });

  it('takes a Calibre category from tags', () => {
    const { rows } = calibre('Dune,Frank Herbert,,,,Ace,2005,4,philosophy');
    expect(rows[0]?.category).toBe('Philosophy');
  });

  it('leaves a Calibre book unread, because Calibre does not track that', () => {
    // Not a shortcoming to fix here: a Calibre catalog has no read-state column
    // at all, so 'Want to Read' is the honest answer rather than a guess.
    const { rows } = calibre('Dune,Frank Herbert,,,,Ace,2005,4,sci-fi');
    expect(rows[0]?.status).toBe('Want to Read');
  });

  // StoryGraph's export columns, trimmed to the ones that carry data.
  const STORYGRAPH = 'Title,Authors,ISBN/UID,Read Status,Last Date Read,Star Rating,Tags';
  const storygraph = (row: string) => parseGoodreadsCsv([STORYGRAPH, row].join('\n'));

  it('reads a StoryGraph author, status and date', () => {
    const { rows } = storygraph('Dune,Frank Herbert,9780441013593,read,2026/02/01,4.0,sci-fi');
    expect(rows[0]).toMatchObject({
      author: 'Frank Herbert',
      status: 'Finished',
      dateRead: '2026/02/01',
    });
  });

  it('truncates a StoryGraph half-star rating', () => {
    // StoryGraph rates in halves and the app's scale is whole stars.
    const { rows } = storygraph('Dune,Frank Herbert,,read,,4.5,');
    expect(rows[0]?.rating).toBe(4);
  });

  it('accepts a StoryGraph ISBN and ignores a non-ISBN UID', () => {
    expect(storygraph('Dune,F H,9780441013593,read,,4,').rows[0]?.isbn13).toBe('9780441013593');
    expect(storygraph('Dune,F H,b4a1-not-an-isbn,read,,4,').rows[0]?.isbn13).toBeUndefined();
  });

  it('maps StoryGraph to-read to Want to Read', () => {
    expect(storygraph('Dune,F H,,to-read,,0,').rows[0]?.status).toBe('Want to Read');
  });
});

describe('column precedence between formats', () => {
  it('prefers the Goodreads column when a file carries both spellings', () => {
    // Pins the order so adding an alias later cannot silently change what a
    // real Goodreads export parses to.
    const { rows } = parseGoodreadsCsv(
      ['Title,Author,Authors,My Rating,Rating', 'Dune,Real Author,Other Author,5,1'].join('\n'),
    );

    expect(rows[0]?.author).toBe('Real Author');
    expect(rows[0]?.rating).toBe(5);
  });

  it('does not mistake the Goodreads average rating for the user rating', () => {
    // 'Average Rating' is every other reader's score, not this reader's. The
    // aliases match a column name exactly, which is what keeps them apart.
    const { rows } = parseGoodreadsCsv(
      ['Title,Author,My Rating,Average Rating', 'Dune,Frank Herbert,2,5'].join('\n'),
    );

    expect(rows[0]?.rating).toBe(2);
  });

  it('still reports a CSV with no title column as the wrong file', () => {
    const { unrecognised } = parseGoodreadsCsv(['Name,Amount', 'Coffee,3.50'].join('\n'));
    expect(unrecognised).toBe(true);
  });
});

describe('coverForIsbn', () => {
  // `?default=false` is load-bearing, not decoration: without it OpenLibrary
  // serves a blank 1x1 placeholder with a 200 for an ISBN it has no cover for,
  // so the <img> "succeeds", BookCover's onError never fires, and an imported
  // library renders rows of empty rectangles instead of initials placeholders.
  it('builds an OpenLibrary URL that 404s rather than serving a blank placeholder', () => {
    expect(coverForIsbn('9780735211292')).toBe(
      'https://covers.openlibrary.org/b/isbn/9780735211292-L.jpg?default=false',
    );
  });

  it('returns undefined without an ISBN', () => {
    expect(coverForIsbn(undefined)).toBeUndefined();
  });
});

describe('coverForIsbn with input that is not an ISBN', () => {
  // Whatever this returns is persisted on the book and rendered in an img src,
  // and the value reaching it came out of a CSV the user picked off disk. It
  // used to build a URL from anything at all.
  it.each([
    ['a URL', 'https://evil.test/x.jpg'],
    ['a path traversal', '../../../etc/passwd'],
    ['a query injection', '123?foo=bar'],
    ['a quoted Goodreads cell', '="9780735211292"'],
    ['too short', '12345'],
    ['letters', 'not-an-isbn'],
    ['empty', ''],
  ])('returns undefined for %s', (_label, value) => {
    const url = coverForIsbn(value);
    // The quoted-cell case is a real ISBN in Goodreads' own escaping, so it is
    // allowed through — but only after being unwrapped to bare digits.
    if (url !== undefined) {
      expect(url).toBe('https://covers.openlibrary.org/b/isbn/9780735211292-L.jpg?default=false');
    } else {
      expect(url).toBeUndefined();
    }
  });

  it('accepts the ISBN-10 X check digit', () => {
    expect(coverForIsbn('097522980X')).toContain('097522980X');
  });
});
