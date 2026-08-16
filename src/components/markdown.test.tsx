import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { formatInline, normaliseMarkdown } from './markdown';

const CLASSES = { strong: 'font-bold', em: 'italic' };

describe('normaliseMarkdown', () => {
  /**
   * The bug this function exists for. The summary arrives inside JSON and gets
   * escaped once too often somewhere upstream, so it carries the two characters
   * `\` and `n` where a newline belongs. `BookDetail` undid that and `EReader`
   * did not, so the same summary paginated correctly in one view and arrived as
   * one unbroken block littered with `\n` in the other.
   */
  it('turns a literal backslash-n into a real newline', () => {
    expect(normaliseMarkdown('First line.\\nSecond line.')).toBe('First line.\nSecond line.');
  });

  it('folds CRLF so block splitting can assume \\n', () => {
    expect(normaliseMarkdown('One\r\n\r\nTwo')).toBe('One\n\nTwo');
  });

  it('leaves text that is already correct alone', () => {
    expect(normaliseMarkdown('One\n\nTwo')).toBe('One\n\nTwo');
  });

  it('handles both forms in one string, which is how they actually arrive', () => {
    // An escaped newline between A and B, a genuine CRLF between B and C.
    expect(normaliseMarkdown('A\\nB\r\nC')).toBe('A\nB\nC');
  });
});

describe('formatInline', () => {
  it('renders **bold** as a strong element carrying the caller’s classes', () => {
    render(<p>{formatInline('a **bold** word', CLASSES)}</p>);

    const strong = screen.getByText('bold');
    expect(strong.tagName).toBe('STRONG');
    expect(strong).toHaveClass('font-bold');
  });

  it('renders *italic* as an em element', () => {
    render(<p>{formatInline('an *emphasised* word', CLASSES)}</p>);

    const em = screen.getByText('emphasised');
    expect(em.tagName).toBe('EM');
    expect(em).toHaveClass('italic');
  });

  it('leaves plain text untouched', () => {
    render(<p data-testid="out">{formatInline('nothing to see', CLASSES)}</p>);
    expect(screen.getByTestId('out')).toHaveTextContent('nothing to see');
    expect(screen.getByTestId('out').querySelector('strong')).toBeNull();
  });

  it('strips the markers rather than printing them', () => {
    render(<p data-testid="out">{formatInline('**one** and *two*', CLASSES)}</p>);
    expect(screen.getByTestId('out').textContent).toBe('one and two');
  });

  it('handles several markers in one line', () => {
    render(<p data-testid="out">{formatInline('**a** then **b**', CLASSES)}</p>);
    expect(screen.getByTestId('out').querySelectorAll('strong')).toHaveLength(2);
  });

  /**
   * An unmatched marker is malformed input, and the model does produce it. The
   * only requirement is that the text survives — dropping half a sentence
   * because of a stray asterisk would be far worse than showing the asterisk.
   */
  it('does not lose text when a marker is unclosed', () => {
    render(<p data-testid="out">{formatInline('an **unclosed marker', CLASSES)}</p>);
    expect(screen.getByTestId('out')).toHaveTextContent('unclosed marker');
  });
});
