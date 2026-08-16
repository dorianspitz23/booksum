import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { BookDetail } from './BookDetail';
import type { Book, Summary } from '../types';

/**
 * A book with no summary is a first-class state: `importGoodreadsRows` creates
 * every book without one so that importing a large library stays free, and
 * `useBookRoute` starts every book at `summary === undefined` until IndexedDB
 * answers. The AI affordances must not be offered in that state.
 */
const book: Book = {
  id: 'book-1',
  profileId: 'profile-1',
  title: 'Atomic Habits',
  author: 'James Clear',
  category: 'Productivity',
  status: 'Finished',
  rating: 5,
  coverImageUrl: '',
  addedAt: new Date(0).toISOString(),
  readingTimeMinutes: 12,
  hasPdf: false,
};

const summary: Summary = {
  id: 'summary-1',
  bookId: 'book-1',
  oneSentenceTakeaway: 'Small changes compound.',
  summary: 'A book about habits.',
  keyInsights: ['Start small.'],
  actionableSteps: ['Do one push-up.'],
  generatedAt: new Date(0).toISOString(),
  model: 'test',
};

function renderDetail(summaryProp: Summary | undefined, onSummarise = vi.fn(async () => {})) {
  render(
    <BookDetail
      book={book}
      summary={summaryProp}
      voice="Kore"
      onSummaryUpdate={vi.fn()}
      onBack={vi.fn()}
      onDelete={vi.fn()}
      onUpdate={vi.fn()}
      onOpenReader={vi.fn()}
      onPlayAudio={vi.fn()}
      onSummarise={onSummarise}
      onAiError={vi.fn(() => 'ai error')}
    />,
  );
  return onSummarise;
}

describe('BookDetail AI affordances', () => {
  it('offers Chat and Quiz for a book that has a summary', () => {
    renderDetail(summary);

    expect(screen.getByRole('button', { name: /chat/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /quiz/i })).toBeInTheDocument();
  });

  it('hides Chat for a book with no summary, because the chat prompt reads the summary', () => {
    renderDetail(undefined);

    expect(screen.queryByRole('button', { name: /chat/i })).not.toBeInTheDocument();
  });

  it('hides Quiz for a book with no summary, because the quiz prompt reads the summary', () => {
    renderDetail(undefined);

    expect(screen.queryByRole('button', { name: /quiz/i })).not.toBeInTheDocument();
  });

  it('still renders the book itself when there is no summary', () => {
    renderDetail(undefined);

    expect(screen.getByText('Atomic Habits')).toBeInTheDocument();
  });

  it('hides Quick Listen and Read Full Summary when there is no summary', () => {
    // Both handlers set a spinner and then hit `if (!summary) return`, so the
    // buttons used to render, flash, and do nothing at all.
    renderDetail(undefined);

    expect(screen.queryByRole('button', { name: /quick listen/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /read full summary/i })).not.toBeInTheDocument();
  });
});

/**
 * Goodreads import creates every book without a summary so that importing a
 * large library costs nothing. Until this existed there was no action anywhere
 * that could give one to those books, so the entire import was a dead end.
 */
describe('BookDetail summarise action', () => {
  it('offers a way to summarise a book that has none', () => {
    renderDetail(undefined);

    expect(screen.getAllByRole('button', { name: /summarise this book/i }).length).toBeGreaterThan(
      0,
    );
  });

  it('does not offer it once the book has a summary', () => {
    renderDetail(summary);

    expect(screen.queryByRole('button', { name: /summarise this book/i })).not.toBeInTheDocument();
  });

  it('explains what generating a summary unlocks', () => {
    renderDetail(undefined);

    expect(screen.getByText(/unlocks chat, the quiz, audio narration/i)).toBeInTheDocument();
  });

  it('calls back when pressed and shows progress', async () => {
    const onSummarise = renderDetail(undefined);

    await userEvent.click(screen.getAllByRole('button', { name: /summarise this book/i })[0]);

    expect(onSummarise).toHaveBeenCalledTimes(1);
  });

  it('surfaces a failure instead of leaving the button spinning', async () => {
    const failing = vi.fn(() => Promise.reject(new Error('nope')));
    renderDetail(undefined, failing);

    await userEvent.click(screen.getAllByRole('button', { name: /summarise this book/i })[0]);

    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /summarise this book/i })[0]).toBeEnabled(),
    );
  });
});

/**
 * Notes used to persist on blur alone. Navigating away mid-sentence — clicking
 * Back, following a link, closing the tab's route — unmounts the textarea
 * without blurring it, and everything typed since the last blur was gone with
 * no warning. Notes are the one thing in this app the user wrote themselves,
 * so losing them is worse than losing any generated content.
 */
describe('BookDetail personal notes', () => {
  it('saves notes typed since the last blur when the view unmounts', async () => {
    const onUpdate = vi.fn();
    const { unmount } = render(
      <BookDetail
        book={book}
        summary={summary}
        voice="Kore"
        onSummaryUpdate={vi.fn()}
        onBack={vi.fn()}
        onDelete={vi.fn()}
        onUpdate={onUpdate}
        onOpenReader={vi.fn()}
        onPlayAudio={vi.fn()}
        onSummarise={vi.fn(async () => {})}
        onAiError={vi.fn(() => 'ai error')}
      />,
    );

    await userEvent.type(screen.getByPlaceholderText(/write down your thoughts/i), 'half a thou');
    expect(onUpdate).not.toHaveBeenCalled(); // still focused — nothing saved yet

    unmount();

    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ personalNotes: 'half a thou' }),
    );
  });

  it('does not write on unmount when the notes are unchanged', () => {
    const onUpdate = vi.fn();
    const { unmount } = render(
      <BookDetail
        book={{ ...book, personalNotes: 'already saved' }}
        summary={summary}
        voice="Kore"
        onSummaryUpdate={vi.fn()}
        onBack={vi.fn()}
        onDelete={vi.fn()}
        onUpdate={onUpdate}
        onOpenReader={vi.fn()}
        onPlayAudio={vi.fn()}
        onSummarise={vi.fn(async () => {})}
        onAiError={vi.fn(() => 'ai error')}
      />,
    );

    unmount();

    expect(onUpdate).not.toHaveBeenCalled();
  });
});
