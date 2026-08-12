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

describe('coverForIsbn', () => {
  it('builds an OpenLibrary URL', () => {
    expect(coverForIsbn('9780735211292')).toBe(
      'https://covers.openlibrary.org/b/isbn/9780735211292-L.jpg',
    );
  });

  it('returns undefined without an ISBN', () => {
    expect(coverForIsbn(undefined)).toBeUndefined();
  });
});
