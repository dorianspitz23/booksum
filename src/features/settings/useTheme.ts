import { useCallback, useEffect, useState } from 'react';
import { useProfile } from '../profile/ProfileContext';
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
