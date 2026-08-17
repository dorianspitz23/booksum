import { useNavigate } from 'react-router';
import { paths } from '../../app/paths';
import { StatsView } from '../../components/StatsView';
import { useLibrary } from '../library/useLibrary';

export function StatsPage() {
  const { books, isLoading } = useLibrary();
  const navigate = useNavigate();

  // An unread library and an empty one are the same empty array. Without this
  // the page rendered "0 books, 0 minutes, 0% of your goal" for the moment
  // before the read resolved — a confident set of numbers about a library it
  // had not looked at yet, on the one page whose whole job is reporting numbers.
  if (isLoading) {
    return (
      <div className="p-8 text-gray-400 dark:text-gray-500" role="status">
        Reading your library…
      </div>
    );
  }

  return <StatsView books={books} onBookClick={(book) => void navigate(paths.book(book.id))} />;
}
