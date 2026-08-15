import { useCallback, useEffect, useState } from 'react';
import { useProfile } from '../profile/ProfileContext';
import { THEME_CACHE } from '../../lib/storageKeys';
import type { Profile } from '../../types';

export type ThemeChoice = Profile['theme'];
export type ResolvedTheme = 'light' | 'dark';

const DARK_QUERY = '(prefers-color-scheme: dark)';

function systemPrefersDark(): boolean {
  return typeof matchMedia === 'function' && matchMedia(DARK_QUERY).matches;
}

export function useTheme() {
  const { profile, updateProfile } = useProfile();
  const theme: ThemeChoice = profile?.theme ?? 'system';
  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const query = matchMedia(DARK_QUERY);
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    query.addEventListener?.('change', onChange);
    return () => query.removeEventListener?.('change', onChange);
  }, []);

  const resolved: ResolvedTheme = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;

  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolved === 'dark');
    // Mirrored for the pre-paint script in index.html. Without this the class is
    // only set once React has mounted and this effect has run, so every load in
    // dark mode flashed a white screen first.
    try {
      localStorage.setItem(THEME_CACHE, resolved);
    } catch {
      // Private-mode browsers throw. The app still themes correctly once mounted;
      // only the pre-paint optimisation is lost, so there is nothing to recover.
    }
  }, [resolved]);

  const setTheme = useCallback(
    async (next: ThemeChoice) => {
      if (!profile) return;
      await updateProfile({ ...profile, theme: next });
    },
    [profile, updateProfile],
  );

  return { theme, resolved, setTheme };
}
