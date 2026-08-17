import { act, cleanup, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ACTIVE_PROFILE_KEY, ProfileProvider } from '../profile/ProfileContext';
import { resetDb } from '../../lib/storage/db';
import { profiles } from '../../lib/storage/repo';
import { useTheme } from './useTheme';
import type { ThemeChoice } from './useTheme';

let api: ReturnType<typeof useTheme>;

function Probe() {
  api = useTheme();
  return <p data-testid="resolved">{api.resolved}</p>;
}

async function renderWithTheme(theme: ThemeChoice) {
  const profile = await profiles.create({ name: 'Dorian', theme });
  localStorage.setItem(ACTIVE_PROFILE_KEY, profile.id);
  render(
    <ProfileProvider>
      <Probe />
    </ProfileProvider>,
  );
  return profile;
}

/**
 * A matchMedia stub that can actually change.
 *
 * The previous one had `addEventListener: vi.fn()` — it recorded the listener
 * and could never call it. So the hook's entire reason for subscribing was
 * untestable, and "follows the system" was only ever verified at the instant of
 * mount. Someone unplugging the subscription would have broken switching your OS
 * to dark while the app is open, with every test still green.
 *
 * Returns a setter so a test can flip the preference and fire the event the
 * browser would fire.
 */
function mockPrefersDark(matches: boolean) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  let current = matches;

  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      get matches() {
        return current;
      },
      media: query,
      addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
        listeners.add(listener);
      },
      removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
        listeners.delete(listener);
      },
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
      onchange: null,
    })),
  );

  return {
    /** Flip the system preference and fire the event a real browser would. */
    set(next: boolean) {
      current = next;
      for (const listener of listeners) {
        listener({ matches: next } as MediaQueryListEvent);
      }
    },
    get listenerCount() {
      return listeners.size;
    },
  };
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

describe('the system preference changing while the app is open', () => {
  it('follows it, and unsubscribes on unmount', async () => {
    // The old stub recorded listeners and could never call them, so this whole
    // path was unverifiable — "follows the system" was only ever checked at the
    // instant of mount.
    const system = mockPrefersDark(false);
    await renderWithTheme('system');
    await waitFor(() => {
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });
    expect(system.listenerCount).toBeGreaterThan(0);

    act(() => {
      system.set(true);
    });
    await waitFor(() => {
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    act(() => {
      system.set(false);
    });
    await waitFor(() => {
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });

    // And it lets go afterwards — a listener left behind writes to the document
    // for a component that no longer exists.
    cleanup();
    expect(system.listenerCount).toBe(0);
  });
});
