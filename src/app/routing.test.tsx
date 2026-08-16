import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import App from '../App';
import { ACTIVE_PROFILE_KEY, ProfileProvider } from '../features/profile/ProfileContext';
import { resetDb } from '../lib/storage/db';
import { books, profiles } from '../lib/storage/repo';

async function seedAndRender() {
  const profile = await profiles.create({ name: 'Dorian' });
  localStorage.setItem(ACTIVE_PROFILE_KEY, profile.id);
  const book = await books.create({
    profileId: profile.id,
    title: 'Atomic Habits',
    author: 'James Clear',
    category: 'Productivity',
    status: 'Finished',
    rating: 5,
    readingTimeMinutes: 12,
    coverImageUrl: '',
    hasPdf: false,
  });
  render(
    <ProfileProvider>
      <App />
    </ProfileProvider>,
  );
  return { profile, book };
}

beforeEach(async () => {
  await resetDb();
  localStorage.clear();
  window.history.pushState({}, '', '/');
  document.documentElement.classList.remove('dark');
});

describe('routing', () => {
  it('starts on the library route', async () => {
    await seedAndRender();
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: /your library/i })).toBeInTheDocument(),
    );
    expect(window.location.pathname).toBe('/');
  });

  it('navigates to a book and puts its id in the URL', async () => {
    const { book } = await seedAndRender();
    await waitFor(() => expect(screen.getByText('Atomic Habits')).toBeInTheDocument());

    await userEvent.click(screen.getByText('Atomic Habits'));

    await waitFor(() => expect(window.location.pathname).toBe(`/book/${book.id}`));
  });

  it('returns to the library when the browser back button is pressed', async () => {
    const { book } = await seedAndRender();
    await waitFor(() => expect(screen.getByText('Atomic Habits')).toBeInTheDocument());
    await userEvent.click(screen.getByText('Atomic Habits'));
    await waitFor(() => expect(window.location.pathname).toBe(`/book/${book.id}`));

    window.history.back();

    await waitFor(() => expect(window.location.pathname).toBe('/'));
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: /your library/i })).toBeInTheDocument(),
    );
  });

  it('renders the stats route directly from its URL', async () => {
    window.history.pushState({}, '', '/stats');
    await seedAndRender();
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: /your progress/i })).toBeInTheDocument(),
    );
    expect(window.location.pathname).toBe('/stats');
  });

  it('applies a dark profile theme on every route, not just the profile page', async () => {
    const profile = await profiles.create({ name: 'Dorian', theme: 'dark' });
    localStorage.setItem(ACTIVE_PROFILE_KEY, profile.id);
    render(
      <ProfileProvider>
        <App />
      </ProfileProvider>,
    );

    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: /your library/i })).toBeInTheDocument(),
    );
    expect(document.documentElement).toHaveClass('dark');
  });

  it('redirects an unknown book id back to the library', async () => {
    window.history.pushState({}, '', '/book/does-not-exist');
    await seedAndRender();
    await waitFor(() => expect(window.location.pathname).toBe('/'));
  });

  it('says "no such page" for an unknown address instead of claiming a crash', async () => {
    window.history.pushState({}, '', '/not-a-real-page');
    await seedAndRender();

    // Without a catch-all route this fell through to the error boundary, which
    // told the user the app had broken. It had not — they had mistyped a URL.
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /no such page/i })).toBeInTheDocument(),
    );
    expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
  });

  it('offers a way back from an unknown address', async () => {
    window.history.pushState({}, '', '/not-a-real-page');
    await seedAndRender();

    // A wrong turn should not be a dead end. Asserted on the link rather than on
    // the nav landmark: the Daily Wisdom modal opens on a timer, and while it is
    // up the page behind it is correctly hidden from the accessibility tree — so
    // a nav assertion here would pass or fail on timing rather than on routing.
    await waitFor(() =>
      expect(screen.getByRole('link', { name: /back to your library/i })).toBeInTheDocument(),
    );
  });
});
