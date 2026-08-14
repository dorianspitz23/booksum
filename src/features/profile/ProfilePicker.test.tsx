import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { ConfirmProvider } from '../../components/ui/ConfirmDialog';
import { resetDb } from '../../lib/storage/db';
import { books as bookRepo, profiles } from '../../lib/storage/repo';
import { ProfilePicker } from './ProfilePicker';
import { ProfileProvider } from './ProfileContext';

function mount() {
  render(
    <ProfileProvider>
      <ConfirmProvider>
        <ProfilePicker />
      </ConfirmProvider>
    </ProfileProvider>,
  );
}

async function seedProfileWithABook(name: string) {
  const profile = await profiles.create({ name });
  await bookRepo.create({
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
  return profile;
}

beforeEach(async () => {
  await resetDb();
  localStorage.clear();
});

/**
 * Deleting a profile cascades to every book, summary, blob and review card it
 * owns. It used to fire on a single unguarded click, and could not be guarded,
 * because ConfirmProvider was mounted inside the has-a-profile branch only.
 */
describe('ProfilePicker delete', () => {
  it('asks before deleting and does nothing when cancelled', async () => {
    const profile = await seedProfileWithABook('Dorian');
    mount();
    await waitFor(() => expect(screen.getByText('Dorian')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: /delete profile dorian/i }));

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /delete dorian\?/i })).toBeInTheDocument(),
    );
    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }));

    await expect(profiles.get(profile.id)).resolves.toBeDefined();
    await expect(bookRepo.listByProfile(profile.id)).resolves.toHaveLength(1);
  });

  it('deletes the profile and its library once confirmed', async () => {
    const profile = await seedProfileWithABook('Dorian');
    mount();
    await waitFor(() => expect(screen.getByText('Dorian')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: /delete profile dorian/i }));
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /delete dorian\?/i })).toBeInTheDocument(),
    );
    // Anchored: the trash control is labelled "Delete profile Dorian", the
    // confirm button is exactly "Delete profile".
    await userEvent.click(screen.getByRole('button', { name: /^delete profile$/i }));

    await waitFor(async () => {
      await expect(profiles.get(profile.id)).resolves.toBeUndefined();
    });
    await expect(bookRepo.listByProfile(profile.id)).resolves.toHaveLength(0);
  });

  it('names the profile being deleted, so the wrong row cannot be confirmed blindly', async () => {
    await seedProfileWithABook('Dorian');
    await seedProfileWithABook('Sam');
    mount();
    await waitFor(() => expect(screen.getByText('Sam')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: /delete profile sam/i }));

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /delete sam\?/i })).toBeInTheDocument(),
    );
    expect(screen.getByText(/sam's entire library/i)).toBeInTheDocument();
  });
});
