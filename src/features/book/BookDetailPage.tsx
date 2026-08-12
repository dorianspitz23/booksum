import { useNavigate } from 'react-router';
import { Loader2 } from 'lucide-react';
import { BookDetail } from '../../components/BookDetail';
import { useBookRoute } from './useBookRoute';
import { useLibrary } from '../library/useLibrary';
import { useProfile } from '../profile/ProfileContext';
import { useShell } from '../../app/ShellContext';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import type { Book } from '../../types';

export function BookDetailPage() {
  const { book, summary, setSummary, isLoading } = useBookRoute();
  const { updateBook, removeBook, saveSummary } = useLibrary();
  const { profile } = useProfile();
  const { playAudio } = useShell();
  const confirm = useConfirm();
  const navigate = useNavigate();

  if (isLoading || !book || !profile) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="animate-spin text-orange-700 dark:text-orange-400" size={32} />
      </div>
    );
  }

  const handleDelete = async (id: string) => {
    const confirmed = await confirm({
      title: 'Remove this book?',
      body: `"${book.title}" and its summary will be deleted from your library.`,
      confirmLabel: 'Remove',
      danger: true,
    });
    if (!confirmed) return;
    await removeBook(id);
    void navigate('/');
  };

  return (
    <BookDetail
      book={book}
      summary={summary}
      voice={profile.favoriteVoice}
      onSummaryUpdate={(next) => {
        setSummary(next);
        void saveSummary(next);
      }}
      onBack={() => void navigate('/')}
      onDelete={(id) => void handleDelete(id)}
      onUpdate={(next: Book) => void updateBook(next)}
      onOpenReader={() => void navigate(`/book/${book.id}/read`)}
      onPlayAudio={playAudio}
    />
  );
}
