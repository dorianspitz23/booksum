import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { migrateThenListProfiles } from '../../lib/storage/migrate';
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
        // Migrate-then-list, as one call. These were two adjacent statements
        // here, and the order between them is load-bearing: list first and a
        // returning user meets an empty "Who's reading?" screen and concludes
        // their library is gone. Nothing but adjacency held them in that order.
        // `migrateThenListProfiles` also swallows a failed migration, because it
        // reads data this app did not write and whatever is already in
        // IndexedDB is still worth showing — a throw here used to skip
        // setIsLoading(false) and pin the app on the spinner on every reload.
        const list = await migrateThenListProfiles();
        if (cancelled) return;

        setAllProfiles(list);

        const storedId = localStorage.getItem(ACTIVE_PROFILE_KEY);
        const restored = storedId ? (list.find((p) => p.id === storedId) ?? null) : null;
        if (!restored && storedId) localStorage.removeItem(ACTIVE_PROFILE_KEY);
        setProfile(restored);
      } catch (error) {
        console.error('[booksum] could not load profiles', error);
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
