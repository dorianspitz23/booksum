import React, { useMemo, useState } from 'react';
import type { Book, BookStatus } from '../types';
import { BarChart3, BookCheck, Bookmark, Star, Timer, TrendingUp, ArrowLeft } from 'lucide-react';
import { BookCard } from './BookCard';

interface StatsViewProps {
  books: Book[];
  onBookClick: (book: Book) => void;
}

export const StatsView: React.FC<StatsViewProps> = ({ books, onBookClick }) => {
  const [filter, setFilter] = useState<BookStatus | null>(null);

  const stats = useMemo(() => {
    const finished = books.filter((b) => b.status === 'Finished');
    const wantToRead = books.filter((b) => b.status === 'Want to Read');
    const totalTime = finished.reduce((acc, b) => acc + b.readingTimeMinutes, 0);

    // Only books the user actually rated. Averaging in the zeros dragged the
    // headline figure toward 0.0 for anyone who imported a finished-but-unrated
    // library from Goodreads.
    const rated = finished.filter((b) => b.rating > 0);
    const avgRating =
      rated.length > 0
        ? (rated.reduce((acc, b) => acc + b.rating, 0) / rated.length).toFixed(1)
        : '—';

    const categoryMap: Record<string, number> = {};
    books.forEach((b) => {
      categoryMap[b.category] = (categoryMap[b.category] || 0) + 1;
    });

    const categoryData = Object.entries(categoryMap).sort((a, b) => b[1] - a[1]);
    // 'Other' is what every Goodreads import lands in, so it says nothing.
    const topCategory = categoryData.find(([name]) => name !== 'Other')?.[0];

    return {
      total: books.length,
      finished,
      wantToRead,
      totalTime,
      avgRating,
      ratedCount: rated.length,
      categoryData,
      topCategory,
    };
  }, [books]);

  const filteredBooks = useMemo(() => {
    if (!filter) return [];
    return books.filter((b) => b.status === filter);
  }, [books, filter]);

  return (
    <div className="max-w-6xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header>
        <span className="text-orange-700 dark:text-orange-400 font-bold uppercase tracking-widest text-xs mb-2 block">
          Personal Dashboard
        </span>
        <h1 className="text-4xl md:text-5xl font-serif font-bold text-gray-900 dark:text-gray-100">
          Your Progress
        </h1>
      </header>

      {/* Hero Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          icon={
            <BookCheck
              className={
                filter === 'Finished' ? 'text-white' : 'text-orange-700 dark:text-orange-400'
              }
            />
          }
          label="Finished"
          value={stats.finished.length}
          subValue={`out of ${stats.total}`}
          onClick={() => setFilter(filter === 'Finished' ? null : 'Finished')}
          isActive={filter === 'Finished'}
          colorClass="bg-orange-600"
        />
        <StatCard
          icon={
            <Bookmark className={filter === 'Want to Read' ? 'text-white' : 'text-amber-500'} />
          }
          label="To Read"
          value={stats.wantToRead.length}
          subValue="Waiting in queue"
          onClick={() => setFilter(filter === 'Want to Read' ? null : 'Want to Read')}
          isActive={filter === 'Want to Read'}
          colorClass="bg-amber-500"
        />
        <StatCard
          icon={<Timer className="text-blue-500" />}
          label="Total Learning"
          value={`${stats.totalTime}m`}
          subValue="Active reading time"
        />
        <StatCard
          icon={<Star className="text-rose-500" />}
          label="Avg. Rating"
          value={stats.avgRating}
          subValue={stats.ratedCount > 0 ? `across ${stats.ratedCount} rated` : 'none rated yet'}
        />
      </div>

      {filter ? (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-serif font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
              {filter === 'Finished' ? (
                <BookCheck className="text-orange-700 dark:text-orange-400" />
              ) : (
                <Bookmark className="text-amber-500" />
              )}
              {filter} Books
            </h3>
            <button
              onClick={() => setFilter(null)}
              className="flex items-center gap-2 text-sm font-bold text-gray-400 dark:text-gray-500 hover:text-orange-700 dark:hover:text-orange-400 transition-colors"
            >
              <ArrowLeft size={16} /> Back to Dashboard
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredBooks.map((book) => (
              <BookCard key={book.id} book={book} onClick={onBookClick} />
            ))}
          </div>

          {filteredBooks.length === 0 && (
            <div className="bg-white dark:bg-gray-900 p-12 rounded-3xl border border-dashed border-gray-200 dark:border-gray-700 text-center">
              <p className="text-gray-400 dark:text-gray-500 font-medium">
                No books found in this category.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Category Breakdown */}
          <div className="lg:col-span-2 bg-white dark:bg-gray-900 p-8 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <BarChart3 className="text-orange-700 dark:text-orange-400" />
                Category Breakdown
              </h3>
            </div>
            <div className="space-y-6">
              {stats.categoryData.map(([cat, count]) => (
                <div key={cat} className="space-y-2">
                  <div className="flex justify-between text-sm font-bold">
                    <span className="text-gray-700 dark:text-gray-300">{cat}</span>
                    <span className="text-orange-700 dark:text-orange-400">
                      {count} book{count !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="h-3 w-full bg-gray-50 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-orange-500 rounded-full transition-all duration-1000"
                      style={{ width: `${(count / stats.total) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
              {stats.categoryData.length === 0 && (
                <div className="py-12 text-center text-gray-400 dark:text-gray-500 font-medium">
                  No category data available yet.
                </div>
              )}
            </div>
          </div>

          {/* Insight Card */}
          <div className="bg-orange-900 text-white p-8 rounded-3xl shadow-xl flex flex-col justify-between">
            <div>
              <TrendingUp size={40} className="mb-6 text-orange-400" />
              <h3 className="text-2xl font-serif font-bold mb-4 italic">Your Reading</h3>
              {/*
                This card used to assert that anyone with more than five finished
                books had a focus "shifting towards more productivity-centric
                topics" — a hardcoded sentence with no connection to their actual
                categories. It now states only what the data says.
              */}
              <p className="text-orange-100 leading-relaxed mb-6">
                {stats.finished.length === 0
                  ? 'Finish a book to start building your knowledge map.'
                  : `${stats.finished.length} book${stats.finished.length === 1 ? '' : 's'} finished` +
                    (stats.topCategory ? `, most often in ${stats.topCategory}.` : '.')}
              </p>
            </div>
            {stats.totalTime > 0 && (
              <div className="pt-6 border-t border-orange-800">
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-2 h-2 rounded-full bg-orange-400" />
                  <span className="font-bold uppercase tracking-widest text-orange-300">
                    {stats.totalTime} minutes of summaries
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subValue: string;
  onClick?: () => void;
  isActive?: boolean;
  colorClass?: string;
}> = ({ icon, label, value, subValue, onClick, isActive, colorClass }) => {
  // Two of these four cards are the page's only filtering control, and this was
  // a <div onClick> with no role, tabIndex or key handler — so the stats filters
  // could not be reached or activated from the keyboard at all.
  const Tag = onClick ? 'button' : 'div';

  return (
    <Tag
      {...(onClick ? { type: 'button' as const, onClick, 'aria-pressed': Boolean(isActive) } : {})}
      className={`w-full text-left p-6 rounded-3xl border transition-all duration-300 group focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 ${
        onClick ? 'cursor-pointer hover:shadow-xl active:scale-95' : ''
      } ${
        isActive
          ? `border-transparent shadow-lg ${colorClass} text-white`
          : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 shadow-sm text-gray-900 dark:text-gray-100'
      }`}
    >
      <span
        className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-colors ${
          isActive ? 'bg-white/20' : 'bg-gray-50 dark:bg-gray-800'
        }`}
      >
        {icon}
      </span>
      <span
        className={`block text-sm font-bold uppercase tracking-widest mb-1 transition-colors ${
          isActive ? 'text-white/70' : 'text-gray-400 dark:text-gray-500'
        }`}
      >
        {label}
      </span>
      <span className="flex items-baseline gap-2">
        <span className="text-3xl font-bold">{value}</span>
        <span
          className={`text-xs font-medium transition-colors ${
            isActive ? 'text-white/60' : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          {subValue}
        </span>
      </span>
    </Tag>
  );
};
