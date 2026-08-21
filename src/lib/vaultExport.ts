import { bookToMarkdown, type LibraryEntry } from './markdown';

export interface VaultNote {
  /** Path inside the archive, forward-slashed. */
  path: string;
  contents: string;
}

/**
 * One folder rather than loose notes. A vault's root is the user's own space,
 * and a 300-book export scattered across it is not something anyone can undo by
 * hand — a single folder is one drag to place and one delete to undo.
 */
const FOLDER = 'BookSum';

/** Long enough for any real title, short enough to leave room in a 255-byte path. */
const MAX_NAME = 100;

/**
 * Reserved by Windows at any path, with or without an extension. One book
 * called 'Con' fails the extraction of the whole archive, not just its own note.
 */
const RESERVED_DEVICE = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

/**
 * A title as a filename.
 *
 * In Obsidian the filename is the note's display name and the target every
 * `[[wikilink]]` resolves against, so this keeps the title readable and removes
 * only what a filesystem or a link cannot hold. A slug would be safer and would
 * leave the user with a sidebar full of `the-selfish-gene`.
 */
export function safeFilename(title: string): string {
  const cleaned = title
    // Illegal in a path component on Windows, and '/' also on macOS and Linux.
    .replace(/[\\/:*?"<>|]/g, '')
    // Live wikilink syntax: a note whose name holds these cannot be linked to.
    .replace(/[[\]#^]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NAME)
    // Windows drops these from the end of a path component, so leaving them
    // would mean the written filename differs from the one we deduplicated.
    .replace(/[. ]+$/, '');

  if (!cleaned) return 'Untitled';
  return RESERVED_DEVICE.test(cleaned) ? `${cleaned} book` : cleaned;
}

/**
 * The library as one markdown note per book.
 *
 * Replaces the single concatenated document: Obsidian needs a file per note for
 * links, backlinks and the graph to mean anything, and a leading `---` in a
 * concatenated file is frontmatter syntax rather than the separator it looked
 * like.
 */
export function libraryToVaultNotes(entries: LibraryEntry[]): VaultNote[] {
  /**
   * Keyed lower-case: Windows and macOS both treat 'Dune' and 'dune' as one
   * file, so a case-sensitive check would let the second silently overwrite the
   * first on extraction.
   */
  const taken = new Set<string>();

  return entries.map(({ book, summary }) => {
    const base = safeFilename(book.title);

    // Loops rather than counts, because the suffixed name can itself be taken —
    // a library holding two 'Dune' and one real 'Dune 2' has three books
    // competing for two names.
    let name = base;
    let suffix = 1;
    while (taken.has(name.toLowerCase())) {
      suffix += 1;
      name = `${base} ${suffix}`;
    }
    taken.add(name.toLowerCase());

    return { path: `${FOLDER}/${name}.md`, contents: bookToMarkdown(book, summary) };
  });
}
