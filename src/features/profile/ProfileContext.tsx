import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { migrateLegacyData } from '../../lib/storage/migrate';
import { profiles as profileRepo } from '../../lib/storage/repo';
import type { Profile } from '../../types';

export { ACTIVE_PROFILE as ACTIVE_PROFILE_KEY } from '../../lib/storageKeys';
import { ACTIVE_PROFILE as ACTIVE_PROFILE_KEY } from '../../lib/storageKeys';

interface ProfileContextValue {
  profile: Profile | null;
  allProfiles: Profile[];
  isLoading: boolean;
  selectProfile: (id: string) => Promise<void>;
  createProfile: (name: string) => Promise<Profile>;
  updateProfile: (profile: Profile) => Promise<void>;
  deleteProfile: (id: string) => Promise<void>;
  signOut: () => void;
}

const ProfileContext = createContext<ProfileContextValue | undefined>(undefined);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        // The migration reads data this app did not write. A throw here used to
        // skip setIsLoading(false) entirely, pinning the app on the loading
        // spinner forever, on every reload, with no way out from inside the app.
        await migrateLegacyData();
      } catch (error) {
        console.error('Legacy migration failed; continuing without it', error);
      }

      try {
        const list = await profileRepo.list();
        if (cancelled) return;

        setAllProfiles(list);

        const storedId = localStorage.getItem(ACTIVE_PROFILE_KEY);
        const restored = storedId ? (list.find((p) => p.id === storedId) ?? null) : null;
        if (!restored && storedId) localStorage.removeItem(ACTIVE_PROFILE_KEY);
        setProfile(restored);
      } catch (error) {
        console.error('Could not load profiles', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const selectProfile = useCallback(async (id: string) => {
    const found = await profileRepo.get(id);
    if (!found) return;
    localStorage.setItem(ACTIVE_PROFILE_KEY, found.id);
    setProfile(found);
  }, []);

  const createProfile = useCallback(async (name: string) => {
    const created = await profileRepo.create({ name });
    setAllProfiles(await profileRepo.list());
    localStorage.setItem(ACTIVE_PROFILE_KEY, created.id);
    setProfile(created);
    return created;
  }, []);

  const updateProfile = useCallback(async (next: Profile) => {
    await profileRepo.update(next);
    setAllProfiles(await profileRepo.list());
    setProfile((current) => (current?.id === next.id ? next : current));
  }, []);

  const deleteProfile = useCallback(async (id: string) => {
    await profileRepo.remove(id);
    setAllProfiles(await profileRepo.list());
    setProfile((current) => {
      if (current?.id !== id) return current;
      localStorage.removeItem(ACTIVE_PROFILE_KEY);
      return null;
    });
  }, []);

  const signOut = useCallback(() => {
    localStorage.removeItem(ACTIVE_PROFILE_KEY);
    setProfile(null);
  }, []);

  const value = useMemo(
    () => ({
      profile,
      allProfiles,
      isLoading,
      selectProfile,
      createProfile,
      updateProfile,
      deleteProfile,
      signOut,
    }),
    [
      profile,
      allProfiles,
      isLoading,
      selectProfile,
      createProfile,
      updateProfile,
      deleteProfile,
      signOut,
    ],
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile(): ProfileContextValue {
  const context = useContext(ProfileContext);
  if (!context) throw new Error('useProfile must be used within a ProfileProvider');
  return context;
}
