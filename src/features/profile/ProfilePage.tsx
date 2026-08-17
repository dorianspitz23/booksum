import { useNavigate } from 'react-router';
import { paths } from '../../app/paths';
import { ProfileView } from '../../components/ProfileView';
import { useProfile } from './ProfileContext';
import { useLibrary } from '../library/useLibrary';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { toast } from '../../components/ui/toastStore';
import { perProfileKeys } from '../../lib/storageKeys';

export function ProfilePage() {
  const { profile, updateProfile } = useProfile();
  const { books, clearLibrary, exportLibrary, importLibrary } = useLibrary();
  const confirm = useConfirm();
  const navigate = useNavigate();

  if (!profile) return null;

  const handleResetLibrary = async () => {
    const confirmed = await confirm({
      title: 'Delete your whole library?',
      body: 'This permanently removes every book, summary and note in this profile. It cannot be undone.',
      confirmLabel: 'Delete everything',
      danger: true,
    });
    if (!confirmed) return;

    try {
      // One transaction, one reload. This used to be Promise.all over
      // removeBook, each of which re-read the whole library afterwards — 300
      // concurrent reads of a shrinking library for a 300-book import, and no
      // atomicity if any one of them failed part-way.
      const removed = await clearLibrary();

      // Built from the same helpers the writers use. These were hardcoded string
      // literals here, so renaming the constant elsewhere would have compiled
      // cleanly and silently stopped reset from clearing anything.
      for (const key of perProfileKeys(profile.id)) localStorage.removeItem(key);

      toast.success(`Removed ${removed} book${removed === 1 ? '' : 's'}.`);
      void navigate(paths.library());
    } catch (error) {
      console.error('[booksum] could not clear the library', error);
      toast.error('Could not clear your library. Nothing was removed.');
    }
  };

  return (
    <ProfileView
      profile={profile}
      onUpdate={(next) => void updateProfile(next)}
      books={books}
      onResetLibrary={() => void handleResetLibrary()}
      buildExport={exportLibrary}
      onImportLibrary={importLibrary}
    />
  );
}
