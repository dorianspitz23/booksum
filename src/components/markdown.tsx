import type { ReactNode } from 'react';

/**
 * The small slice of markdown the summariser actually emits, shared by the two
 * places that render it.
 *
 * `BookDetail` and `EReader` each grew their own copy of this. The copies were
 * not merely duplicated — they diverged in ways a reader could see. `BookDetail`
 * normalised literal `\n` escape sequences and ran inline formatting inside
 * headings; `EReader` did neither, so the same summary showed raw `\n` and
 * literal `**` in one view and rendered text in the other.
 *
 * The two views keep their own block layout on purpose: the reader is a serif,
 * drop-capped, page-turning surface and the detail view is a compact scroll.
 * What lives here is the part that must agree — what the source text *means*.
 */

/**
 * Models routinely return the two characters `\` and `n` where a newline was
 * intended, because the summary is delivered inside JSON and has been escaped
 * once too often somewhere along the way. Without this, a whole summary renders
 * as one unbroken paragraph with `\n` scattered through it. CRLF is folded at
 * the same time so block splitting can assume `\n`.
 */
export function normaliseMarkdown(text: string): string {
  return text.replace(/\\n/g, '\n').replace(/\r\n/g, '\n');
}

interface InlineOptions {
  /** Classes for `**bold**`. */
  strong: string;
  /** Classes for `*italic*`. */
  em: string;
}

/**
 * Renders `**bold**` and `*italic*` inside a single line of text.
 *
 * The class names are supplied by the caller because the reader inherits colour
 * from its own theme while the detail view uses the app palette — the styling
 * is genuinely different, the parsing must not be.
 */
export function formatInline(text: string, options: InlineOptions): ReactNode[] {
  return text.split(/(\*\*.*?\*\*|\*.*?\*)/g).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className={options.strong}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return (
        <em key={i} className={options.em}>
          {part.slice(1, -1)}
        </em>
      );
    }
    return part;
  });
}
