import { useNavigate } from 'react-router';
import { ProfileView } from '../../components/ProfileView';
import { useProfile } from './ProfileContext';
import { useLibrary } from '../library/useLibrary';
import { useConfirm } from '../../components/ui/ConfirmDialog';

export function ProfilePage() {
  const { profile, updateProfile } = useProfile();
  const { books, removeBook, exportLibrary, importLibrary } = useLibrary();
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

    await Promise.all(books.map((book) => removeBook(book.id)));
    localStorage.removeItem(`booksum.recs.${profile.id}`);
    localStorage.removeItem(`booksum_daily_wisdom_${profile.id}`);
    void navigate('/');
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
