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

export function bookToMarkdown(book: Book, summary?: Summary): string {
  const lines: string[] = [
    `# ${escapeField(book.title)}`,
    '',
    `*by ${escapeField(book.author)}*`,
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

export function libraryToMarkdown(entries: LibraryEntry[]): string {
  const header = [
    '# My BookSum Library',
    '',
    `${entries.length} book${entries.length === 1 ? '' : 's'}`,
    '',
    '---',
    '',
  ];

  const body = entries.map(({ book, summary }) => bookToMarkdown(book, summary));
  return [...header, body.join('\n---\n\n')].join('\n');
}
