/**
 * @vitest-environment node
 *
 * No DOM here, so this suite skips the jsdom window the default environment
 * builds. See src/test/setup.ts.
 */
import { describe, expect, it } from 'vitest';
import { bookToMarkdown } from './markdown';
import type { Book, Summary } from '../types';

const book: Book = {
  id: 'b1',
  profileId: 'p1',
  title: 'Atomic Habits',
  author: 'James Clear',
  category: 'Productivity',
  status: 'Finished',
  rating: 5,
  readingTimeMinutes: 12,
  coverImageUrl: '',
  addedAt: '2026-02-01T00:00:00.000Z',
  hasPdf: false,
  personalNotes: 'Start with two minutes.',
};

const summary: Summary = {
  id: 's1',
  bookId: 'b1',
  oneSentenceTakeaway: 'Small changes compound.',
  summary: 'A body paragraph.',
  keyInsights: ['Systems beat goals.', 'Identity drives habit.'],
  actionableSteps: ['Habit stack.'],
  generatedAt: '2026-02-01T00:00:00.000Z',
  model: 'test-model',
};

describe('bookToMarkdown', () => {
  it('leads with a title and author below the frontmatter', () => {
    const md = bookToMarkdown(book, summary);
    expect(md).toContain('\n# Atomic Habits\n');
    expect(md).toContain('*by [[James Clear]]*');
  });

  it('includes the takeaway, insights, steps and notes', () => {
    const md = bookToMarkdown(book, summary);
    expect(md).toContain('> Small changes compound.');
    expect(md).toContain('- Systems beat goals.');
    expect(md).toContain('- Habit stack.');
    expect(md).toContain('Start with two minutes.');
  });

  it('includes the deep dive when there is one', () => {
    const md = bookToMarkdown(book, { ...summary, detailedSummary: '## Chapter one' });
    expect(md).toContain('## Deep Dive');
    expect(md).toContain('## Chapter one');
  });

  it('handles a book with no summary', () => {
    const md = bookToMarkdown(book, undefined);
    expect(md).toContain('# Atomic Habits');
    expect(md).toContain('Not summarised yet.');
    expect(md).not.toContain('## Key Insights');
  });

  it('omits the notes section when there are none', () => {
    expect(bookToMarkdown({ ...book, personalNotes: undefined }, summary)).not.toContain(
      '## My Notes',
    );
  });

  it('omits the notes section for whitespace-only notes', () => {
    expect(bookToMarkdown({ ...book, personalNotes: '   ' }, summary)).not.toContain('## My Notes');
  });

  it('omits empty insight and step sections', () => {
    const md = bookToMarkdown(book, { ...summary, keyInsights: [], actionableSteps: [] });
    expect(md).not.toContain('## Key Insights');
    expect(md).not.toContain('## Actionable Steps');
  });

  it('is deterministic', () => {
    expect(bookToMarkdown(book, summary)).toBe(bookToMarkdown(book, summary));
  });
});

/**
 * The frontmatter block is what makes an exported note more than text in
 * Obsidian: properties are what Dataview, Bases and the property sidebar read.
 * `**Status:** Finished` in the body is invisible to all three.
 */
describe('frontmatter', () => {
  const frontmatterOf = (md: string) => {
    const match = /^---\n([\s\S]*?)\n---\n/.exec(md);
    if (!match?.[1]) throw new Error('no frontmatter block');
    return match[1];
  };

  it('opens the note with a delimited block', () => {
    const md = bookToMarkdown(book, summary);
    // A vault reader only treats this as properties when it is the very first
    // thing in the file — a leading blank line demotes it to a horizontal rule.
    expect(md.startsWith('---\n')).toBe(true);
  });

  it('carries the fields a vault query would filter on', () => {
    const fields = frontmatterOf(bookToMarkdown(book, summary));

    expect(fields).toContain('title: "Atomic Habits"');
    expect(fields).toContain('author: "James Clear"');
    expect(fields).toContain('status: "Finished"');
    expect(fields).toContain('category: "Productivity"');
    expect(fields).toContain('rating: 5');
    expect(fields).toContain('readingTimeMinutes: 12');
  });

  it('writes dates as plain dates, not timestamps', () => {
    const fields = frontmatterOf(
      bookToMarkdown({ ...book, finishedAt: '2026-03-15T09:12:00.000Z' }, summary),
    );

    // Dataview parses `2026-02-01` as a date and an ISO timestamp as a string,
    // so a timestamp here silently breaks sorting and date arithmetic.
    expect(fields).toContain('added: 2026-02-01');
    expect(fields).toContain('finished: 2026-03-15');
  });

  it('omits the finished date when the book is unfinished', () => {
    expect(
      frontmatterOf(bookToMarkdown({ ...book, finishedAt: undefined }, summary)),
    ).not.toContain('finished:');
  });

  it('tags the note as a book and by category', () => {
    const fields = frontmatterOf(bookToMarkdown(book, summary));
    expect(fields).toContain('tags: [book, productivity]');
  });

  it('slugifies a category that would be an invalid tag', () => {
    // Obsidian tags cannot contain spaces or '#'. 'Sci-Fi #2' as a raw tag ends
    // the list early and leaves a stray '#2' that reads as a second tag.
    const fields = frontmatterOf(bookToMarkdown({ ...book, category: 'Sci-Fi #2' }, summary));

    expect(fields).toContain('tags: [book, sci-fi-2]');
    expect(fields).toContain('category: "Sci-Fi #2"');
  });

  it('drops the category tag when there is no usable category', () => {
    const fields = frontmatterOf(bookToMarkdown({ ...book, category: '###' }, summary));
    expect(fields).toContain('tags: [book]');
  });

  it('escapes quotes and backslashes rather than markdown characters', () => {
    // YAML and markdown have different dangerous characters. A title with a
    // quote in it ends the scalar early and the whole block fails to parse,
    // taking every property with it — while '#' is harmless inside quotes.
    const fields = frontmatterOf(
      bookToMarkdown({ ...book, title: 'He said "hi" \\ #1', author: 'A "B" C' }, summary),
    );

    expect(fields).toContain(String.raw`title: "He said \"hi\" \\ #1"`);
    expect(fields).toContain(String.raw`author: "A \"B\" C"`);
  });

  it('keeps a multi-line title on one line', () => {
    // A raw newline inside a double-quoted scalar is legal YAML but folds, so
    // the property loses the break; an unescaped one mid-block is worse.
    const fields = frontmatterOf(bookToMarkdown({ ...book, title: 'One\nTwo' }, summary));
    expect(fields).toContain(String.raw`title: "One\nTwo"`);
  });

  it('still renders a heading and body below the block', () => {
    const md = bookToMarkdown(book, summary);
    expect(md).toContain('# Atomic Habits');
    expect(md).toContain('> Small changes compound.');
  });
});

describe('author wikilink', () => {
  it('links the author so a vault gets backlinks and a graph', () => {
    expect(bookToMarkdown(book, summary)).toContain('*by [[James Clear]]*');
  });

  it('strips characters a link target cannot hold', () => {
    // '[', ']', '#', '|' and '^' all terminate or re-target a wikilink.
    const md = bookToMarkdown({ ...book, author: 'A[B]C#D|E^F' }, summary);
    expect(md).toContain('*by [[ABCDEF]]*');
  });

  it('falls back to plain text when nothing linkable is left', () => {
    // The frontmatter still carries the real value, so this asserts on the
    // byline alone rather than on the whole document.
    const byline = bookToMarkdown({ ...book, author: '[[]]' }, summary)
      .split('\n')
      .find((line) => line.startsWith('*by '));

    expect(byline).toBe(String.raw`*by \[\[\]\]*`);
  });
});

describe('field values that are themselves markdown', () => {
  it('escapes a title that would otherwise change the document structure', () => {
    // Field values sit inside markdown syntax and are not markdown themselves.
    // "# 1 Bestseller" opened a heading inside the heading, "*Batman*" came out
    // italic, and "[Dune](evil)" became a link in the exported file.
    const md = bookToMarkdown({
      ...book,
      title: '# 1 Bestseller *Batman* [Dune](x)',
      author: 'A_B',
      category: 'Sci-Fi #2',
    });

    expect(md).toContain(String.raw`# \# 1 Bestseller \*Batman\* \[Dune\](x)`);
    expect(md).toContain(String.raw`**Category:** Sci-Fi \#2`);
    // The author is a link target now, where markdown escaping would point the
    // link at a note whose name contains a literal backslash.
    expect(md).toContain('*by [[A_B]]*');
  });

  it('leaves the summary body and personal notes as written', () => {
    // These are markdown on purpose — escaping them would defeat the export.
    const md = bookToMarkdown(
      { ...book, personalNotes: '## My heading\n\n- a point' },
      {
        id: 's1',
        bookId: 'b1',
        oneSentenceTakeaway: 'Takeaway.',
        summary: '## Section\n\n**bold** text',
        keyInsights: [],
        actionableSteps: [],
        generatedAt: '2026-01-01T00:00:00.000Z',
        model: 'test',
      },
    );

    expect(md).toContain('## Section\n\n**bold** text');
    expect(md).toContain('## My heading\n\n- a point');
  });
});
