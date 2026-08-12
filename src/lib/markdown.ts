import type { Book, Summary } from '../types';

export interface LibraryEntry {
  book: Book;
  summary?: Summary;
}

export function bookToMarkdown(book: Book, summary?: Summary): string {
  const lines: string[] = [`# ${book.title}`, '', `*by ${book.author}*`, ''];

  lines.push(
    `**Status:** ${book.status}  `,
    `**Category:** ${book.category}  `,
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
