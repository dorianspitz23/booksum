import React, { useState } from 'react';
import type { Book } from '../types';
import { BookCover } from './BookCover';
import { Clock, Star, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';

interface BookCardProps {
  book: Book;
  onClick: (book: Book) => void;
}

export const BookCard: React.FC<BookCardProps> = ({ book, onClick }) => {
  const [imageLoaded, setImageLoaded] = useState(false);

  const getPriorityColor = (p?: string) => {
    switch (p) {
      case 'High':
        return 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-200 dark:border-rose-800';
      case 'Medium':
        return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800';
      default:
        return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-800';
    }
  };

  /*
   * This was a bare <div onClick> with no role, tabIndex or key handler, and it
   * is the only way to open a book from the library grid and from the stats
   * drill-down — so a keyboard or screen-reader user could search and filter
   * their library but could not open anything in it.
   *
   * role/tabIndex/onKeyDown rather than a <button>: the card's interior is a
   * nested div structure containing a heading, and neither is valid inside a
   * button element.
   */
  const open = () => onClick(book);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Open ${book.title} by ${book.author}`}
      onClick={open}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          open();
        }
      }}
      className="group bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-500 cursor-pointer border border-gray-100 dark:border-gray-800 flex flex-col h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
    >
      <div className="relative aspect-[3/4.5] overflow-hidden bg-gray-50 dark:bg-gray-800">
        {!imageLoaded && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-200">
            <Loader2 className="animate-spin" size={24} />
          </div>
        )}
        <BookCover
          title={book.title}
          url={book.coverImageUrl}
          onLoad={() => setImageLoaded(true)}
          className={`w-full h-full object-cover transition-all duration-700 ${imageLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-105'} group-hover:scale-110`}
        />
        {/* An unsummarised import used to advertise a masterclass that does not
            exist, one line above a body correctly reading 'Not summarised yet'. */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity duration-300 flex items-end p-5">
          <span className="text-white text-sm font-bold flex items-center gap-2 tracking-wide">
            {book.oneSentenceTakeaway ? 'Read Masterclass' : 'Summarise this book'}
            <ArrowRight size={16} />
          </span>
        </div>
        <div className="absolute top-4 left-4 flex flex-col gap-2">
          <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur shadow-xl px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-[0.1em] text-orange-700 dark:text-orange-400 w-fit">
            {book.category}
          </div>
          {book.status === 'Want to Read' && book.priority && (
            <div
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-[0.1em] border backdrop-blur-md shadow-xl flex items-center gap-1.5 w-fit ${getPriorityColor(book.priority)}`}
            >
              <AlertCircle size={12} />
              {book.priority}
            </div>
          )}
        </div>
      </div>

      <div className="p-6 flex-grow flex flex-col">
        <h3 className="text-xl font-serif font-bold text-gray-900 dark:text-gray-100 line-clamp-2 mb-2 group-hover:text-orange-700 dark:group-hover:text-orange-400 transition-colors leading-tight">
          {book.title}
        </h3>
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4 tracking-tight">
          by {book.author}
        </p>

        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3 mb-6 leading-relaxed italic border-l-2 border-orange-100 dark:border-orange-900 pl-4">
          {book.oneSentenceTakeaway ? `"${book.oneSentenceTakeaway}"` : 'Not summarised yet'}
        </p>

        <div className="mt-auto pt-5 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
          {/* `readingTimeMinutes` is an estimate the summariser produces, so it
              is 0 on every imported and hand-added book. Rendering that as
              "0 min read" asserts something about the book that is not true, so
              the chip waits until there is a real figure. */}
          <div className="flex items-center gap-2 text-gray-400 dark:text-gray-500 font-bold text-[10px] uppercase tracking-widest">
            {book.readingTimeMinutes > 0 && (
              <>
                <Clock size={14} className="text-orange-500" />
                <span>{book.readingTimeMinutes} min read</span>
              </>
            )}
          </div>
          {book.status === 'Finished' && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-50 dark:bg-amber-950 rounded-md">
              <Star size={12} className="text-amber-500 fill-amber-500" />
              <span className="font-black text-amber-700 dark:text-amber-300 text-[10px]">
                {book.rating}/5
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
