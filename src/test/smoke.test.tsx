import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { ProfileProvider } from '../features/profile/ProfileContext';
import { resetDb } from '../lib/storage/db';

function renderApp() {
  return render(
    <ProfileProvider>
      <App />
    </ProfileProvider>,
  );
}

beforeEach(async () => {
  await resetDb();
  localStorage.clear();
});

describe('smoke', () => {
  it('boots to the profile picker with no key and no data', async () => {
    renderApp();
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /who.s reading\?/i })).toBeInTheDocument(),
    );
  });

  it('creates a profile and lands in the library', async () => {
    renderApp();
    await waitFor(() => expect(screen.getByLabelText(/your name/i)).toBeInTheDocument());

    await userEvent.type(screen.getByLabelText(/your name/i), 'Dorian');
    await userEvent.click(screen.getByRole('button', { name: /start reading/i }));

    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: /your library/i })).toBeInTheDocument(),
    );
    // The empty state now waits for IndexedDB rather than flashing before it, so
    // this is genuinely asynchronous.
    await waitFor(() => expect(screen.getByText(/your library is quiet/i)).toBeInTheDocument());
  });

  it('makes no network call to Gemini on boot', async () => {
    const fetchSpy = vi.fn(async (input: RequestInfo | URL) => {
      void input;
      return new Response('{}', { status: 200 });
    });
    vi.stubGlobal('fetch', fetchSpy);

    renderApp();
    await waitFor(() => expect(screen.getByLabelText(/your name/i)).toBeInTheDocument());

    await userEvent.type(screen.getByLabelText(/your name/i), 'Dorian');
    await userEvent.click(screen.getByRole('button', { name: /start reading/i }));
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: /your library/i })).toBeInTheDocument(),
    );

    for (const call of fetchSpy.mock.calls) {
      expect(String(call[0])).not.toContain('generativelanguage');
    }
    vi.unstubAllGlobals();
  });

  it('opens the key dialog when an AI action runs without a key', async () => {
    renderApp();
    await waitFor(() => expect(screen.getByLabelText(/your name/i)).toBeInTheDocument());
    await userEvent.type(screen.getByLabelText(/your name/i), 'Dorian');
    await userEvent.click(screen.getByRole('button', { name: /start reading/i }));
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: /your library/i })).toBeInTheDocument(),
    );

    // The library skeleton resolves before the empty-state call to action exists.
    const addFirst = await screen.findByRole('button', { name: /add your first book/i });
    await userEvent.click(addFirst);
    await userEvent.type(screen.getByPlaceholderText(/sapiens, atomic habits/i), 'Deep Work');
    await userEvent.click(screen.getByRole('button', { name: /generate insights/i }));

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /connect gemini/i })).toBeInTheDocument(),
    );

    // Only one modal at a time: two aria-modal dialogs means two focus traps.
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
  });

  it('shows a loading placeholder before the library resolves, not an empty state', async () => {
    // The empty state used to render on every visit while IndexedDB was still
    // answering, so a returning user with 200 books saw "your library is quiet"
    // and an Add Your First Book button before their shelves appeared.
    renderApp();
    await waitFor(() => expect(screen.getByLabelText(/your name/i)).toBeInTheDocument());
    await userEvent.type(screen.getByLabelText(/your name/i), 'Dorian');
    await userEvent.click(screen.getByRole('button', { name: /start reading/i }));

    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: /your library/i })).toBeInTheDocument(),
    );
    await waitFor(() => expect(screen.getByText(/your library is quiet/i)).toBeInTheDocument());

    // Once resolved the busy placeholder is gone.
    expect(screen.queryByLabelText(/loading your library/i)).not.toBeInTheDocument();
  });
});
