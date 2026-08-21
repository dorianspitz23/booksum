/**
 * @vitest-environment node
 *
 * No DOM here, so this suite skips the jsdom window the default environment
 * builds. See src/test/setup.ts.
 */
import { describe, expect, it } from 'vitest';
import { libraryToVaultNotes } from './vaultExport';
import type { Book } from '../types';

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
};

const withTitle = (title: string, id = 'b1') => ({ book: { ...book, id, title } });

describe('libraryToVaultNotes', () => {
  it('writes one note per book', () => {
    const notes = libraryToVaultNotes([
      withTitle('Atomic Habits', 'b1'),
      withTitle('Deep Work', 'b2'),
    ]);
    expect(notes).toHaveLength(2);
  });

  it('files notes under a single folder', () => {
    // A vault is a folder of loose notes. Extracting 300 files into its root
    // is not a thing anyone can undo by hand.
    const [note] = libraryToVaultNotes([withTitle('Atomic Habits')]);
    expect(note?.path).toBe('BookSum/Atomic Habits.md');
  });

  it('names notes after the title, not a slug', () => {
    // In Obsidian the filename IS the note's display name and its wikilink
    // target, so 'the-selfish-gene' reads as a URL slug in the sidebar forever.
    const [note] = libraryToVaultNotes([withTitle('The Selfish Gene')]);
    expect(note?.path).toBe('BookSum/The Selfish Gene.md');
  });

  it('carries the full note body', () => {
    const [note] = libraryToVaultNotes([withTitle('Atomic Habits')]);
    expect(note?.contents).toContain('title: "Atomic Habits"');
    expect(note?.contents).toContain('# Atomic Habits');
  });

  it('includes the summary when the book has one', () => {
    const notes = libraryToVaultNotes([
      {
        book,
        summary: {
          id: 's1',
          bookId: 'b1',
          oneSentenceTakeaway: 'Small changes compound.',
          summary: 'Body.',
          keyInsights: ['Systems beat goals.'],
          actionableSteps: [],
          generatedAt: '2026-02-01T00:00:00.000Z',
          model: 'test',
        },
      },
    ]);

    expect(notes[0]?.contents).toContain('> Small changes compound.');
    expect(notes[0]?.contents).toContain('- Systems beat goals.');
  });

  it('removes characters no filesystem will take', () => {
    const [note] = libraryToVaultNotes([withTitle('Where/When: Why? "Really" <ok> *star*')]);
    expect(note?.path).toBe('BookSum/WhereWhen Why Really ok star.md');
  });

  it('removes characters that break a wikilink to the note', () => {
    // '[', ']', '#', '^' and '|' are all live syntax in [[...]], so a note whose
    // own name contains them cannot be linked to.
    const [note] = libraryToVaultNotes([withTitle('Book [One] #2 ^3 |4')]);
    expect(note?.path).toBe('BookSum/Book One 2 3 4.md');
  });

  it('suffixes a second book whose title lands on the same filename', () => {
    const notes = libraryToVaultNotes([
      withTitle('Dune', 'b1'),
      withTitle('Dune', 'b2'),
      withTitle('Dune', 'b3'),
    ]);

    expect(notes.map((n) => n.path)).toEqual([
      'BookSum/Dune.md',
      'BookSum/Dune 2.md',
      'BookSum/Dune 3.md',
    ]);
  });

  it('collides on the sanitised name, not the raw title', () => {
    // 'Dune: Part One' and 'Dune Part One' both sanitise to the same filename.
    // Writing both would silently drop one book from the export.
    const notes = libraryToVaultNotes([
      withTitle('Dune: Part One', 'b1'),
      withTitle('Dune Part One', 'b2'),
    ]);
    expect(new Set(notes.map((n) => n.path)).size).toBe(2);
  });

  it('falls back for a title with nothing usable in it', () => {
    const [note] = libraryToVaultNotes([withTitle('###')]);
    expect(note?.path).toBe('BookSum/Untitled.md');
  });

  it('truncates a title too long for a filename', () => {
    const [note] = libraryToVaultNotes([withTitle('A'.repeat(300))]);
    const name = note?.path.replace('BookSum/', '').replace('.md', '') ?? '';
    expect(name.length).toBeLessThanOrEqual(100);
  });

  it('renames a title that collides with a reserved device name', () => {
    // Windows refuses to create CON.md, NUL.md and friends at any path, so one
    // book called 'Con' fails the extraction of the entire archive.
    const notes = libraryToVaultNotes([withTitle('Con', 'b1'), withTitle('nul', 'b2')]);
    expect(notes.map((n) => n.path)).toEqual(['BookSum/Con book.md', 'BookSum/nul book.md']);
  });

  it('trims trailing dots and spaces', () => {
    // Windows silently drops both from a path component, so 'Why.' would be
    // written as 'Why' and a second book called 'Why' would then overwrite it.
    const [note] = libraryToVaultNotes([withTitle('Why...')]);
    expect(note?.path).toBe('BookSum/Why.md');
  });

  it('returns nothing for an empty library', () => {
    expect(libraryToVaultNotes([])).toEqual([]);
  });
});
