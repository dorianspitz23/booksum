import { useNavigate } from 'react-router';
import { StatsView } from '../../components/StatsView';
import { useLibrary } from '../library/useLibrary';

export function StatsPage() {
  const { books } = useLibrary();
  const navigate = useNavigate();

  return <StatsView books={books} onBookClick={(book) => void navigate(`/book/${book.id}`)} />;
}
