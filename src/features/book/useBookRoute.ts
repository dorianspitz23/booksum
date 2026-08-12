import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useLibrary } from '../library/useLibrary';
import type { Book, Summary } from '../../types';

/** Resolves the :id route param to a book plus its summary. Redirects home if unknown. */
export function useBookRoute() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { books, isLoading, getSummary } = useLibrary();

  const [summary, setSummary] = useState<Summary | undefined>(undefined);
  const book: Book | undefined = books.find((candidate) => candidate.id === id);

  useEffect(() => {
    if (isLoading) return;
    if (!book) {
      void navigate('/', { replace: true });
      return;
    }
    void getSummary(book.id).then(setSummary);
  }, [book, isLoading, getSummary, navigate]);

  return { book, summary, setSummary, isLoading };
}
