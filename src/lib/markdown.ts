import type { Book, Summary } from '../types';

export interface LibraryEntry {
  book: Book;
  summary?: Summary;
}

/**
 * Escapes the characters that would change a value's meaning where it lands.
 *
 * Field values are interpolated into positions with markdown syntax around them
 * — a heading, an emphasis pair, a blockquote — and are not markdown themselves.
 * A book called "*Batman*" came out italic; one called "# 1 Bestseller" opened a
 * heading inside a heading; a `[title](x)` became a link. This applies only to
 * *fields*. Summary bodies and the user's own notes are left alone: those are
 * markdown by intent, and escaping them would ruin the export's whole purpose.
 */
const escapeField = (value: string): string => value.replace(/([\\`*_[\]#<>|])/g, '\\$1');

/**
 * A double-quoted YAML scalar.
 *
 * Deliberately not `escapeField`: the two formats fear different characters. A
 * quote ends a YAML scalar early and takes the whole property block down with
 * it, while `#` is inert inside quotes — and in markdown it is the reverse.
 * Escaping for the wrong one of the two corrupts the value either way.
 */
const yamlString = (value: string): string =>
  `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, '\\n')}"`;

/**
 * A category as an Obsidian tag.
 *
 * Not `slugify` from download.ts, which falls back to 'untitled' for a value
 * with no alphanumerics — correct for a filename, wrong here, where the honest
 * answer is that there is no tag to write.
 */
const tagSlug = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/**
 * The inside of a `[[wikilink]]`.
 *
 * These five characters each end or re-aim a link: `]` closes it, `[` nests,
 * `#` jumps to a heading, `^` to a block and `|` starts the display alias. They
 * are removed rather than escaped, because a wikilink target is matched against
 * a note's name literally — a backslash in it would look for a different note.
 */
const wikilinkTarget = (value: string): string =>
  value
    .replace(/[[\]#|^]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** The date half of an ISO timestamp, and nothing if it is not one. */
const isoDate = (value: string | undefined): string | undefined =>
  /^\d{4}-\d{2}-\d{2}/.test(value ?? '') ? value?.slice(0, 10) : undefined;

function frontmatter(book: Book): string[] {
  const added = isoDate(book.addedAt);
  const finished = isoDate(book.finishedAt);
  const category = tagSlug(book.category);

  return [
    '---',
    `title: ${yamlString(book.title)}`,
    `author: ${yamlString(book.author)}`,
    `status: ${yamlString(book.status)}`,
    `category: ${yamlString(book.category)}`,
    `rating: ${book.rating}`,
    `readingTimeMinutes: ${book.readingTimeMinutes}`,
    ...(added ? [`added: ${added}`] : []),
    ...(finished ? [`finished: ${finished}`] : []),
    `tags: [${['book', ...(category ? [category] : [])].join(', ')}]`,
    '---',
    '',
  ];
}

export function bookToMarkdown(book: Book, summary?: Summary): string {
  const linkTarget = wikilinkTarget(book.author);

  const lines: string[] = [
    ...frontmatter(book),
    `# ${escapeField(book.title)}`,
    '',
    // A link, so every book by one author backlinks to a single note and shows
    // up as one cluster in the graph. Nothing inside `[[ ]]` is markdown, which
    // is why the escape is skipped on this branch and kept on the other.
    linkTarget ? `*by [[${linkTarget}]]*` : `*by ${escapeField(book.author)}*`,
    '',
  ];

  lines.push(
    `**Status:** ${book.status}  `,
    `**Category:** ${escapeField(book.category)}  `,
    `**Rating:** ${book.rating}/5  `,
    `**Reading time:** ${book.readingTimeMinutes} min`,
    '',
  );

  if (!summary) {
    lines.push('Not summarised yet.', '');
  } else {
    lines.push(`> ${summary.oneSentenceTakeaway}`, '', '## Summary', '', summary.summary, '');

    if (summary.keyInsights.length > 0) {
      lines.push('## Key Insights', '', ...summary.keyInsights.map((i) => `- ${i}`), '');
    }
    if (summary.actionableSteps.length > 0) {
      lines.push('## Actionable Steps', '', ...summary.actionableSteps.map((s) => `- ${s}`), '');
    }
    if (summary.detailedSummary) {
      lines.push('## Deep Dive', '', summary.detailedSummary, '');
    }
  }

  if (book.personalNotes?.trim()) {
    lines.push('## My Notes', '', book.personalNotes.trim(), '');
  }

  return lines.join('\n');
}
