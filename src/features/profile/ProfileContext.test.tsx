import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '../../lib/storage/db';
import { books, profiles } from '../../lib/storage/repo';
import { ACTIVE_PROFILE_KEY, ProfileProvider, useProfile } from './ProfileContext';
import { defined } from '../../test/defined';

function Probe() {
  const { profile, allProfiles, isLoading, createProfile, selectProfile, signOut } = useProfile();
  if (isLoading) return <p>loading</p>;
  return (
    <div>
      <p data-testid="active">{profile?.name ?? 'none'}</p>
      <p data-testid="count">{allProfiles.length}</p>
      <button onClick={() => void createProfile('Dorian')}>create</button>
      <button onClick={() => void selectProfile(defined(allProfiles[0], 'first profile').id)}>
        select first
      </button>
      <button onClick={signOut}>sign out</button>
    </div>
  );
}

function renderProbe() {
  return render(
    <ProfileProvider>
      <Probe />
    </ProfileProvider>,
  );
}

beforeEach(async () => {
  await resetDb();
  localStorage.clear();
});

describe('ProfileContext', () => {
  it('starts with no active profile', async () => {
    renderProbe();
    await waitFor(() => expect(screen.getByTestId('active')).toHaveTextContent('none'));
  });

  it('selects a newly created profile and persists the selection', async () => {
    renderProbe();
    await waitFor(() => expect(screen.getByTestId('active')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'create' }));

    await waitFor(() => expect(screen.getByTestId('active')).toHaveTextContent('Dorian'));
    expect(screen.getByTestId('count')).toHaveTextContent('1');
    expect(localStorage.getItem(ACTIVE_PROFILE_KEY)).toBeTruthy();
  });

  it('restores the persisted profile on mount', async () => {
    const created = await profiles.create({ name: 'Restored' });
    localStorage.setItem(ACTIVE_PROFILE_KEY, created.id);

    renderProbe();
    await waitFor(() => expect(screen.getByTestId('active')).toHaveTextContent('Restored'));
  });

  it('clears the selection on sign out without deleting the profile', async () => {
    const created = await profiles.create({ name: 'Dorian' });
    localStorage.setItem(ACTIVE_PROFILE_KEY, created.id);

    renderProbe();
    await waitFor(() => expect(screen.getByTestId('active')).toHaveTextContent('Dorian'));

    await userEvent.click(screen.getByRole('button', { name: 'sign out' }));

    await waitFor(() => expect(screen.getByTestId('active')).toHaveTextContent('none'));
    expect(localStorage.getItem(ACTIVE_PROFILE_KEY)).toBeNull();
    await expect(profiles.list()).resolves.toHaveLength(1);
  });

  it('ignores a stale persisted id', async () => {
    localStorage.setItem(ACTIVE_PROFILE_KEY, 'does-not-exist');
    renderProbe();
    await waitFor(() => expect(screen.getByTestId('active')).toHaveTextContent('none'));
  });

  it('keeps each profile library separate', async () => {
    const a = await profiles.create({ name: 'A' });
    const b = await profiles.create({ name: 'B' });
    await books.create({
      profileId: a.id,
      title: 'Only A',
      author: 'x',
      category: 'Other',
      status: 'Finished',
      rating: 0,
      readingTimeMinutes: 0,
      coverImageUrl: '',
      hasPdf: false,
    });

    await expect(books.listByProfile(a.id)).resolves.toHaveLength(1);
    await expect(books.listByProfile(b.id)).resolves.toHaveLength(0);
  });
});
