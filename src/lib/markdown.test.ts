/**
 * @vitest-environment node
 *
 * No DOM here, so this suite skips the jsdom window the default environment
 * builds. See src/test/setup.ts.
 */
import { describe, expect, it } from 'vitest';
import { bookToMarkdown, libraryToMarkdown } from './markdown';
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
  it('leads with a title and author', () => {
    const md = bookToMarkdown(book, summary);
    expect(md.startsWith('# Atomic Habits\n')).toBe(true);
    expect(md).toContain('*by James Clear*');
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

describe('libraryToMarkdown', () => {
  it('writes a heading and one section per book', () => {
    const md = libraryToMarkdown([
      { book, summary },
      { book: { ...book, id: 'b2', title: 'Deep Work' }, summary: undefined },
    ]);
    expect(md).toContain('# My BookSum Library');
    expect(md).toContain('Atomic Habits');
    expect(md).toContain('Deep Work');
    expect(md).toContain('2 books');
  });

  it('uses the singular for one book', () => {
    expect(libraryToMarkdown([{ book, summary }])).toContain('1 book\n');
  });

  it('handles an empty library', () => {
    expect(libraryToMarkdown([])).toContain('0 books');
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
    expect(md).toContain(String.raw`*by A\_B*`);
    expect(md).toContain(String.raw`**Category:** Sci-Fi \#2`);
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
