import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { ConfirmProvider } from '../../components/ui/ConfirmDialog';
import { resetDb } from '../../lib/storage/db';
import { books as bookRepo, profiles } from '../../lib/storage/repo';
import { ProfilePicker } from './ProfilePicker';
import { ACTIVE_PROFILE_KEY, ProfileProvider } from './ProfileContext';

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

/**
 * Choosing a profile is the entire point of this screen and nothing tested it.
 * Selection is what scopes every subsequent read and write, so if it silently
 * failed — an unknown id, a write that never landed — the user would be handed
 * someone else's library, or a blank one, with no error anywhere.
 */
describe('ProfilePicker selection', () => {
  it('remembers the profile that was chosen', async () => {
    const first = await seedProfileWithABook('Dorian');
    const second = await seedProfileWithABook('Someone Else');
    mount();

    await waitFor(() => expect(screen.getByText('Someone Else')).toBeInTheDocument());
    // Exact, not a substring: 'Delete profile Someone Else' also contains the name.
    await userEvent.click(screen.getByRole('button', { name: 'Someone Else' }));

    // Persisted, so a reload lands in the same library rather than back here.
    await waitFor(() => expect(localStorage.getItem(ACTIVE_PROFILE_KEY)).toBe(second.id));
    expect(localStorage.getItem(ACTIVE_PROFILE_KEY)).not.toBe(first.id);
  });

  it('lists every profile as its own way in', async () => {
    await seedProfileWithABook('Dorian');
    await seedProfileWithABook('Someone Else');
    mount();

    await waitFor(() => expect(screen.getByText('Dorian')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Dorian' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Someone Else' })).toBeInTheDocument();
  });
});
