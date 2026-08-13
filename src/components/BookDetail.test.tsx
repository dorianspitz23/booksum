import { render, screen } from '@testing-library/react';
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

function renderDetail(summaryProp: Summary | undefined) {
  return render(
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
    />,
  );
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
});
