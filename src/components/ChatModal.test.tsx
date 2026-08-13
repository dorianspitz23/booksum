import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatModal } from './ChatModal';
import { clearApiKey } from '../lib/ai/apiKey';
import { resetClientCache } from '../lib/ai/client';
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

beforeEach(() => {
  // The state of every fresh install: no Gemini key stored.
  localStorage.clear();
  clearApiKey();
  resetClientCache();
});

describe('ChatModal with no API key', () => {
  it('reports the missing key instead of throwing out of the effect', async () => {
    const onAiError = vi.fn(() => 'Add your Gemini API key to use AI features.');

    // Before this was fixed the throw escaped the effect, reached the router
    // error boundary and replaced the whole app with the error screen.
    render(<ChatModal book={book} summary={summary} onClose={vi.fn()} onAiError={onAiError} />);

    await waitFor(() => expect(onAiError).toHaveBeenCalled());
  });

  it('stays open and shows the reason, rather than disappearing behind a crash', async () => {
    render(
      <ChatModal
        book={book}
        summary={summary}
        onClose={vi.fn()}
        onAiError={vi.fn(() => 'Add your Gemini API key to use AI features.')}
      />,
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/Add your Gemini API key/i),
    );
  });

  it('disables the composer when there is no usable session', async () => {
    render(
      <ChatModal book={book} summary={summary} onClose={vi.fn()} onAiError={vi.fn(() => 'nope')} />,
    );

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByPlaceholderText(/chat unavailable/i)).toBeDisabled();
  });
});
