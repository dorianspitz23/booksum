import React, { useId, useRef } from 'react';
import { useFocusTrap } from './ui/useFocusTrap';
import { BookCover } from './BookCover';
import type { Book, Summary } from '../types';
import { X, BookOpen, Sun, Sparkles } from 'lucide-react';

interface DailyWisdomModalProps {
  book: Book;
  summary: Summary | undefined;
  onClose: () => void;
  onReadMore: () => void;
}

export const DailyWisdomModal: React.FC<DailyWisdomModalProps> = ({
  book,
  summary,
  onClose,
  onReadMore,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useFocusTrap(panelRef, { active: true, onClose });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-500"
      >
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-br from-orange-400 to-rose-500" />

        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/40 text-white rounded-full backdrop-blur-md transition-colors z-10"
        >
          <X size={20} />
        </button>

        <div className="relative pt-12 px-8 pb-8 flex flex-col items-center text-center">
          <div className="w-20 h-20 bg-white dark:bg-gray-900 rounded-2xl shadow-xl flex items-center justify-center mb-6 rotate-3 border-4 border-orange-50">
            <Sun size={40} className="text-orange-500 fill-orange-500" />
          </div>

          <h2
            id={titleId}
            className="text-sm font-bold uppercase tracking-widest text-orange-700 dark:text-orange-400 mb-6 bg-orange-50 dark:bg-orange-950 px-3 py-1 rounded-full border border-orange-100"
          >
            Daily Wisdom
          </h2>

          <blockquote className="text-2xl font-serif font-bold text-gray-900 dark:text-gray-100 leading-relaxed mb-8">
            {summary?.oneSentenceTakeaway
              ? `"${summary.oneSentenceTakeaway}"`
              : 'This book has no summary yet.'}
          </blockquote>

          {/* Presentational, deliberately. This was a div with an onClick —
              invisible to the keyboard — and it duplicated the "Read summary"
              button directly beneath it. Two controls doing one job, one of
              them unreachable. Naming the book is the row's actual purpose. */}
          <div className="flex items-center gap-4 bg-gray-50 dark:bg-gray-800 p-3 rounded-xl w-full mb-8 border border-gray-100 dark:border-gray-800 text-left">
            <div className="w-12 h-16 flex-shrink-0 shadow-sm rounded-md overflow-hidden relative">
              {/* Shared, so a missing or dead cover falls back here the same way
                  it does everywhere else. Rendering the URL raw showed the
                  browser's broken-image glyph. */}
              <BookCover
                title={book.title}
                url={book.coverImageUrl}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-gray-900 dark:text-gray-100 line-clamp-1">
                {book.title}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">by {book.author}</p>
            </div>
            <div className="mr-2 text-orange-300">
              <BookOpen size={20} />
            </div>
          </div>

          <div className="flex gap-3 w-full">
            <button
              onClick={onReadMore}
              className="flex-1 py-3 bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 rounded-xl font-bold shadow-lg shadow-gray-200 dark:shadow-none hover:scale-[1.02] hover:bg-black dark:hover:bg-white transition-all flex items-center justify-center gap-2"
            >
              <Sparkles size={18} /> Read Summary
            </button>
            <button
              onClick={onClose}
              className="flex-1 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 rounded-xl font-bold hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
