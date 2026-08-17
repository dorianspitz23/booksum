import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useLibrary } from '../library/useLibrary';
import type { Book, Summary } from '../../types';

/**
 * Resolves the :id route param to a book plus its summary. Redirects home if the
 * id is unknown.
 *
 * Everything here is keyed on ids rather than on the objects themselves.
 * `listByProfile` deserialises fresh objects on every reload, so a `book`
 * dependency changed identity after any unrelated library write — which re-ran
 * the summary fetch and handed consumers a brand-new `Summary` reference. That
 * was the upstream cause of two expensive downstream bugs: QuizModal regenerated
 * a paid quiz, and ChatModal rebuilt its session and silently discarded the
 * conversation mid-chat.
 */
export function useBookRoute() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { books, isLoading, getSummary } = useLibrary();

  const [summary, setSummary] = useState<Summary | undefined>(undefined);
  const [summaryFailed, setSummaryFailed] = useState(false);

  const book: Book | undefined = books.find((candidate) => candidate.id === id);
  const bookId = book?.id;
  const summaryId = book?.summaryId;
  const isMissing = !isLoading && !bookId;

  useEffect(() => {
    if (isMissing) void navigate('/', { replace: true });
  }, [isMissing, navigate]);

  useEffect(() => {
    if (!bookId) return;

    let cancelled = false;
    setSummaryFailed(false);
    getSummary(bookId)
      .then((found) => {
        if (!cancelled) setSummary(found);
      })
      .catch((error: unknown) => {
        // Reported, not swallowed. Setting undefined and stopping there rendered
        // the book's "not summarised yet" state — telling the user their book
        // has no summary when in fact the read failed, and inviting them to pay
        // for one they already have.
        console.error('[booksum] could not load the summary for this book', error);
        if (cancelled) return;
        setSummary(undefined);
        setSummaryFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [bookId, summaryId, getSummary]);

  return { book, summary, setSummary, summaryFailed, isLoading };
}
