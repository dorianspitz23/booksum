import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EReader } from './EReader';
import type { Book, Summary } from '../types';

const book: Book = {
  id: 'book-1',
  profileId: 'profile-1',
  title: 'Atomic Habits',
  author: 'James Clear',
  category: 'Productivity',
  status: 'Finished',
  rating: 5,
  coverImageUrl: '',
  addedAt: '2026-01-01T00:00:00.000Z',
  readingTimeMinutes: 12,
  hasPdf: false,
};

const summary: Summary = {
  id: 'summary-1',
  bookId: 'book-1',
  oneSentenceTakeaway: 'Small changes compound.',
  summary: 'A book about habits.',
  keyInsights: [],
  actionableSteps: [],
  detailedSummary: '## One\n\nFirst section.\n\n## Two\n\nSecond section.\n\n## Three\n\nThird.',
  generatedAt: '2026-01-01T00:00:00.000Z',
  model: 'test',
};

function renderReader(overrides: Partial<React.ComponentProps<typeof EReader>> = {}) {
  const onClose = vi.fn();
  const onProgress = vi.fn();
  render(
    <EReader
      book={book}
      summary={summary}
      voice="Kore"
      onClose={onClose}
      onPlayAudio={vi.fn()}
      {...{ onProgress }}
      {...overrides}
    />,
  );
  return { onClose, onProgress };
}

describe('EReader keyboard access', () => {
  it('closes on Escape', async () => {
    // The reader covers the whole viewport, but the only way out used to be
    // clicking one specific icon — no Escape, no focus trap.
    const { onClose } = renderReader();

    await userEvent.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('turns pages with the arrow keys', async () => {
    // Three sections, so the progress readout steps 33 → 67 → 100.
    renderReader();

    expect(screen.getByText(/33% complete/i)).toBeInTheDocument();
    await userEvent.keyboard('{ArrowRight}');
    await waitFor(() => expect(screen.getByText(/67% complete/i)).toBeInTheDocument());
    await userEvent.keyboard('{ArrowLeft}');
    await waitFor(() => expect(screen.getByText(/33% complete/i)).toBeInTheDocument());
  });

  it('exposes itself as a modal dialog with a name', () => {
    renderReader();

    expect(screen.getByRole('dialog', { name: /reading atomic habits/i })).toBeInTheDocument();
  });
});

describe('EReader reading position', () => {
  it('reopens on the section it was left on', () => {
    // "% Complete" was computed and displayed but never stored, so the reader
    // always reopened at section one and the progress bar meant nothing.
    renderReader({ book: { ...book, lastReadSection: 2 } });

    expect(screen.getByText(/100% complete/i)).toBeInTheDocument();
  });

  it('reports the new section when the page turns', async () => {
    const { onProgress } = renderReader();

    await userEvent.keyboard('{ArrowRight}');

    await waitFor(() => expect(onProgress).toHaveBeenCalledWith(1));
  });

  it('clamps a stored section past the end of a regenerated summary', async () => {
    renderReader({ book: { ...book, lastReadSection: 99 } });

    // A regenerated summary can be shorter than the one last read, which would
    // otherwise leave the reader on a section that no longer exists.
    await waitFor(() => expect(screen.getByText(/100% complete/i)).toBeInTheDocument());
  });
});

/**
 * Every control in the settings panel was icon- or glyph-only. The three theme
 * buttons announced as unnamed; the four size buttons all announced as "Aa",
 * indistinguishable from each other; and which one was active was conveyed by a
 * ring or by opacity, neither of which a screen reader reports.
 */
describe('EReader display settings', () => {
  async function openSettings() {
    renderReader();
    await userEvent.click(screen.getByRole('button', { name: /display settings/i }));
  }

  it('names each theme and reports which is active', async () => {
    await openSettings();

    expect(screen.getByRole('button', { name: /light theme/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sepia theme/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /dark theme/i })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('distinguishes the four text sizes by name rather than by glyph', async () => {
    await openSettings();

    // Exact names, not substrings: "Large text" is a prefix of "Extra large
    // text", and a substring match would pass while the two were still
    // indistinguishable to anyone listening.
    for (const name of ['Small text', 'Medium text', 'Large text', 'Extra large text']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
  });

  it('remembers a chosen theme, which used to reset to light on every open', async () => {
    await openSettings();

    await userEvent.click(screen.getByRole('button', { name: /sepia theme/i }));

    expect(localStorage.getItem('booksum.reader.theme')).toBe('sepia');
    expect(screen.getByRole('button', { name: /sepia theme/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});
