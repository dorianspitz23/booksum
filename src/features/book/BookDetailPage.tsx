import { useNavigate } from 'react-router';
import { paths } from '../../app/paths';
import { Loader2 } from 'lucide-react';
import { BookDetail } from '../../components/BookDetail';
import { useBookRoute } from './useBookRoute';
import { useLibrary } from '../library/useLibrary';
import { useProfile } from '../profile/ProfileContext';
import { useShell } from '../../app/ShellContext';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { summarizeBook } from '../../lib/ai/summarize';
import { newId } from '../../lib/id';
import type { Book, Summary } from '../../types';

export function BookDetailPage() {
  const { book, summary, setSummary, summaryFailed, isLoading } = useBookRoute();
  const { updateBook, removeBook, saveSummary } = useLibrary();
  const { profile } = useProfile();
  const { playAudio, handleAiError } = useShell();
  const confirm = useConfirm();
  const navigate = useNavigate();

  if (isLoading || !book || !profile) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="animate-spin text-orange-700 dark:text-orange-400" size={32} />
      </div>
    );
  }

  /**
   * The only path from an unsummarised book to a summarised one. Goodreads import
   * deliberately creates books without summaries, and until this existed there
   * was nothing anywhere that could give one to them.
   */
  const handleSummarise = async () => {
    const generated = await summarizeBook(book.title, book.author);
    const summaryId = newId();
    const next: Summary = { ...generated.summary, id: summaryId, bookId: book.id };

    await saveSummary(next);
    await updateBook({
      ...book,
      summaryId,
      // Denormalised onto Book so list views can render without loading summaries.
      oneSentenceTakeaway: next.oneSentenceTakeaway,
      readingTimeMinutes: generated.book.readingTimeMinutes,
      // Only fill in what the book does not already have: an imported book's own
      // category and cover are the user's, not the model's, to overwrite.
      category: book.category === 'Other' ? generated.book.category : book.category,
      coverImageUrl: book.coverImageUrl || generated.book.coverImageUrl,
    });
    setSummary(next);
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirm({
      title: 'Remove this book?',
      body: `"${book.title}" and its summary will be deleted from your library.`,
      confirmLabel: 'Remove',
      danger: true,
    });
    if (!confirmed) return;
    await removeBook(id);
    void navigate(paths.library());
  };

  return (
    <BookDetail
      book={book}
      summary={summary}
      summaryFailed={summaryFailed}
      voice={profile.favoriteVoice}
      onSummaryUpdate={(next) => {
        setSummary(next);
        void saveSummary(next);
      }}
      onBack={() => void navigate(paths.library())}
      onDelete={(id) => void handleDelete(id)}
      onUpdate={(next: Book) => void updateBook(next)}
      onOpenReader={() => void navigate(paths.reader(book.id))}
      onPlayAudio={playAudio}
      onSummarise={handleSummarise}
      onAiError={handleAiError}
    />
  );
}
