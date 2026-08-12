import { act, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ACTIVE_PROFILE_KEY, ProfileProvider } from '../profile/ProfileContext';
import { resetDb } from '../../lib/storage/db';
import { profiles } from '../../lib/storage/repo';
import { useTheme } from './useTheme';

let api: ReturnType<typeof useTheme>;

function Probe() {
  api = useTheme();
  return <p data-testid="resolved">{api.resolved}</p>;
}

async function renderWithTheme(theme: 'system' | 'light' | 'dark') {
  const profile = await profiles.create({ name: 'Dorian', theme });
  localStorage.setItem(ACTIVE_PROFILE_KEY, profile.id);
  render(
    <ProfileProvider>
      <Probe />
    </ProfileProvider>,
  );
  return profile;
}

function mockPrefersDark(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
      onchange: null,
    })),
  );
}

beforeEach(async () => {
  await resetDb();
  localStorage.clear();
  document.documentElement.classList.remove('dark');
  mockPrefersDark(false);
});

describe('useTheme', () => {
  it('applies the dark class when the profile asks for dark', async () => {
    await renderWithTheme('dark');
    await waitFor(() => expect(document.documentElement).toHaveClass('dark'));
  });

  it('removes the dark class for a light profile', async () => {
    document.documentElement.classList.add('dark');
    await renderWithTheme('light');
    await waitFor(() => expect(document.documentElement).not.toHaveClass('dark'));
  });

  it('follows the system preference when set to system', async () => {
    mockPrefersDark(true);
    await renderWithTheme('system');
    await waitFor(() => expect(document.documentElement).toHaveClass('dark'));
  });

  it('resolves system to light when the system is light', async () => {
    mockPrefersDark(false);
    await renderWithTheme('system');
    await waitFor(() => expect(document.documentElement).not.toHaveClass('dark'));
  });

  it('persists a change to the profile', async () => {
    const profile = await renderWithTheme('light');

    // setTheme is a no-op until the profile context resolves, so wait for the
    // profile's own theme to surface rather than merely for the hook to exist.
    await waitFor(() => expect(api.theme).toBe('light'));

    await act(async () => {
      await api.setTheme('dark');
    });

    await waitFor(async () => expect((await profiles.get(profile.id))?.theme).toBe('dark'));
  });

  it('ignores a theme change before any profile is active', async () => {
    render(
      <ProfileProvider>
        <Probe />
      </ProfileProvider>,
    );
    await waitFor(() => expect(api.theme).toBe('system'));

    await act(async () => {
      await api.setTheme('dark');
    });

    await expect(profiles.list()).resolves.toHaveLength(0);
  });
});
