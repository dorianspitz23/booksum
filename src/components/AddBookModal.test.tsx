import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AddBookModal } from './AddBookModal';
import type * as AiClientModule from '../lib/ai/client';
import type { AddBookOptions, BookDraft } from '../features/library/useLibrary';
import { defined } from '../test/defined';

/** Typed so mock.calls carries the real argument shape. */
const addSpy = () => vi.fn((_draft: BookDraft, _options?: AddBookOptions) => Promise.resolve());

/**
 * getClient is the choke point every AI capability goes through, so a spy on it
 * catches an accidental call from anywhere.
 */
const aiClient = vi.hoisted(() => ({ getClient: vi.fn() }));

vi.mock('../lib/ai/client', async (importOriginal) => {
  const actual = await importOriginal<typeof AiClientModule>();
  aiClient.getClient.mockImplementation(actual.getClient);
  return { ...actual, getClient: aiClient.getClient };
});

vi.mock('../lib/covers', () => ({
  fetchCover: vi.fn(() => Promise.resolve('https://example.test/cover.jpg')),
  placeholderCover: vi.fn(() => 'data:image/svg+xml,placeholder'),
}));

beforeEach(() => {
  aiClient.getClient.mockClear();
  localStorage.clear();
});

describe('adding a book without an API key', () => {
  it('adds the typed book and spends nothing', async () => {
    const onAdd = addSpy();
    const onClose = vi.fn();
    render(<AddBookModal onClose={onClose} onAdd={onAdd} onAiError={() => 'err'} />);

    await userEvent.type(screen.getByPlaceholderText(/sapiens, atomic habits/i), 'Deep Work');
    await userEvent.click(screen.getByRole('button', { name: /add without ai/i }));

    await waitFor(() => expect(onAdd).toHaveBeenCalledTimes(1));

    // The README says the library works with no key. Every add path except the
    // Goodreads CSV tab went through summarizeBook or summarizePdf, so a keyless
    // user could import three hundred books at once and not add one.
    expect(aiClient.getClient).not.toHaveBeenCalled();

    const draft = defined(onAdd.mock.calls[0], 'onAdd call')[0];
    expect(draft.title).toBe('Deep Work');
    // No summary: the book is added unsummarised, exactly like an import, and
    // the detail page's "Summarise this book" button takes it from there.
    expect(defined(onAdd.mock.calls[0], 'onAdd call')[1]).toBeUndefined();
    expect(onClose).toHaveBeenCalled();
  });

  it('still uses the free cover chain, which needs no key', async () => {
    const onAdd = addSpy();
    render(<AddBookModal onClose={vi.fn()} onAdd={onAdd} onAiError={() => 'err'} />);

    await userEvent.type(screen.getByPlaceholderText(/sapiens, atomic habits/i), 'Deep Work');
    await userEvent.click(screen.getByRole('button', { name: /add without ai/i }));

    await waitFor(() => expect(onAdd).toHaveBeenCalled());
    const draft = defined(onAdd.mock.calls[0], 'onAdd call')[0];
    expect(draft.coverImageUrl).toBe('https://example.test/cover.jpg');
  });

  it('is disabled until a title is typed', () => {
    render(<AddBookModal onClose={vi.fn()} onAdd={vi.fn()} onAiError={() => 'err'} />);

    expect(screen.getByRole('button', { name: /add without ai/i })).toBeDisabled();
  });

  it('is not offered on the PDF tab, where there is nothing to add without AI', async () => {
    render(<AddBookModal onClose={vi.fn()} onAdd={vi.fn()} onAiError={() => 'err'} />);

    await userEvent.click(screen.getByRole('button', { name: /upload pdf/i }));

    expect(screen.queryByRole('button', { name: /add without ai/i })).not.toBeInTheDocument();
  });
});
