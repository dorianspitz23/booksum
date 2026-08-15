import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Bookmark, CheckCircle, Filter, Layers, Library, Search } from 'lucide-react';
import { BookCard } from '../../components/BookCard';
import { RecommendationCarousel } from './RecommendationCarousel';
import { useLibrary } from './useLibrary';
import { useProfile } from '../profile/ProfileContext';
import { useShell } from '../../app/ShellContext';
import { summarizeBook } from '../../lib/ai/summarize';
import { getAIRecommendations } from '../../lib/ai/recommend';
import type { Recommendation } from '../../lib/ai/recommend';
import { toast } from '../../components/ui/toastStore';
import { RECOMMENDED_BOOKS, RECS_TTL_MS } from './recommendationDefaults';
import { recommendationsKey } from '../../lib/storageKeys';
import type { BookStatus } from '../../types';

export function LibraryPage() {
  const { profile } = useProfile();
  const { books, isLoading, addBook, getSummary } = useLibrary();
  const { openAddBook, handleAiError } = useShell();
  const navigate = useNavigate();

  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | BookStatus>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [recommendations, setRecommendations] = useState<Recommendation[]>(RECOMMENDED_BOOKS);
  const [isRefreshingRecs, setIsRefreshingRecs] = useState(false);
  const [addingBookTitle, setAddingBookTitle] = useState<string | null>(null);

  // Cached recommendations. No AI call fires on load — refreshing is explicit.
  useEffect(() => {
    if (!profile) return;
    const cached = localStorage.getItem(recommendationsKey(profile.id));
    if (!cached) return;
    try {
      const parsed = JSON.parse(cached) as { at: number; items: Recommendation[] };
      if (Date.now() - parsed.at < RECS_TTL_MS && parsed.items?.length) {
        setRecommendations(parsed.items);
      }
    } catch {
      localStorage.removeItem(recommendationsKey(profile.id));
    }
  }, [profile]);

  const filteredBooks = useMemo(() => {
    return books
      .filter((book) => {
        const matchesCategory = activeCategory === 'All' || book.category === activeCategory;
        const matchesStatus = statusFilter === 'All' || book.status === statusFilter;
        const matchesSearch =
          book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          book.author.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        if (a.status === 'Want to Read' && b.status === 'Want to Read') {
          const priorityScore: Record<string, number> = { High: 3, Medium: 2, Low: 1 };
          const scoreA = priorityScore[a.priority || 'Low'] ?? 1;
          const scoreB = priorityScore[b.priority || 'Low'] ?? 1;
          if (scoreA !== scoreB) return scoreB - scoreA;
        }
        return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
      });
  }, [books, activeCategory, searchQuery, statusFilter]);

  const categories = ['All', ...Array.from(new Set(books.map((b) => b.category)))];

  const refreshRecommendations = async () => {
    if (!profile || books.length === 0 || isRefreshingRecs) return;
    setIsRefreshingRecs(true);
    try {
      const next = await getAIRecommendations(books);
      if (next.length > 0) {
        setRecommendations(next);
        localStorage.setItem(
          recommendationsKey(profile.id),
          JSON.stringify({ at: Date.now(), items: next }),
        );
      }
    } catch (error) {
      handleAiError(error);
    } finally {
      setIsRefreshingRecs(false);
    }
  };

  const previewRecommendation = async (rec: Recommendation) => {
    if (addingBookTitle) return;
    setAddingBookTitle(rec.title);
    try {
      const { book, summary } = await summarizeBook(rec.title, rec.author);
      const created = await addBook(
        { ...book, oneSentenceTakeaway: summary.oneSentenceTakeaway },
        { summary },
      );
      await getSummary(created.id);
      void navigate(`/book/${created.id}`);
    } catch (error) {
      toast.error(handleAiError(error));
    } finally {
      setAddingBookTitle(null);
    }
  };

  if (!profile) return null;

  const isFiltered = Boolean(searchQuery) || statusFilter !== 'All' || activeCategory !== 'All';

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('All');
    setActiveCategory('All');
  };

  // The carousel is hidden while the library is still resolving, so it does not
  // flash a set of hardcoded defaults before the user's own cache arrives.
  const showRecommendations = !isLoading && recommendations.length > 0 && !isFiltered;

  return (
    <div className="max-w-7xl mx-auto space-y-10">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <span className="text-orange-700 dark:text-orange-400 font-bold uppercase tracking-widest text-xs mb-2 block">
            Welcome, {profile.name.split(' ')[0]}
          </span>
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-gray-900 dark:text-gray-100">
            Your Library
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative group">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 group-focus-within:text-orange-500 transition-colors"
              size={20}
            />
            <input
              type="text"
              aria-label="Search your titles"
              placeholder="Search your titles..."
              className="pl-12 pr-6 py-4 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl w-full md:w-80 shadow-sm focus:ring-2 focus:ring-orange-500 outline-none transition-all text-gray-900 dark:text-gray-100"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </header>

      <div className="flex flex-col space-y-4">
        <div className="flex bg-gray-100 dark:bg-gray-800 p-1.5 rounded-2xl w-fit">
          <button
            onClick={() => setStatusFilter('All')}
            aria-pressed={statusFilter === 'All'}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${statusFilter === 'All' ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'}`}
          >
            <Layers size={16} /> All
          </button>
          <button
            onClick={() => setStatusFilter('Finished')}
            aria-pressed={statusFilter === 'Finished'}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${statusFilter === 'Finished' ? 'bg-white dark:bg-gray-900 text-emerald-700 dark:text-emerald-400 shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-emerald-700'}`}
          >
            <CheckCircle size={16} /> Finished
          </button>
          <button
            onClick={() => setStatusFilter('Want to Read')}
            aria-pressed={statusFilter === 'Want to Read'}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${statusFilter === 'Want to Read' ? 'bg-white dark:bg-gray-900 text-amber-700 dark:text-amber-400 shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-amber-700'}`}
          >
            <Bookmark size={16} /> Want to Read
          </button>
        </div>

        <div className="flex items-center gap-4 overflow-x-auto pb-4 scrollbar-hide">
          <div className="flex items-center gap-2 pr-4 border-r border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 flex-shrink-0">
            <Filter size={18} />
            <span className="text-sm font-bold uppercase tracking-tighter">Topic</span>
          </div>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              aria-pressed={activeCategory === cat}
              className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all border ${
                activeCategory === cat
                  ? 'bg-gray-900 text-white border-gray-900 dark:bg-gray-100 dark:text-gray-900 dark:border-gray-100 shadow-lg'
                  : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-gray-200 dark:hover:border-gray-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* isLoading was never consulted, so every single visit painted a full
          "your library is quiet" screen — Add Your First Book and all — before
          IndexedDB answered and the real library replaced it. */}
      {isLoading ? (
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8"
          aria-busy="true"
          aria-label="Loading your library"
        >
          {Array.from({ length: 8 }, (_, index) => (
            <div
              key={index}
              className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden animate-pulse"
            >
              <div className="aspect-[3/4.5] bg-gray-100 dark:bg-gray-800" />
              <div className="p-6 space-y-3">
                <div className="h-5 w-3/4 rounded bg-gray-100 dark:bg-gray-800" />
                <div className="h-4 w-1/2 rounded bg-gray-100 dark:bg-gray-800" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredBooks.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {filteredBooks.map((book) => (
            <BookCard key={book.id} book={book} onClick={() => void navigate(`/book/${book.id}`)} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-6">
            <Library size={40} className="text-gray-300 dark:text-gray-600" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            {isFiltered ? 'Nothing matches those filters' : 'Your library is quiet'}
          </h3>
          <p className="text-gray-500 dark:text-gray-400 max-w-sm mb-8">
            {isFiltered
              ? 'Try widening your search, or clear the filters to see everything.'
              : 'Start adding your favorite books and let AI extract the wisdom for you.'}
          </p>
          {/* Telling someone with 200 books who filtered to an empty set to "add
              your first book" was simply the wrong action. */}
          <button
            onClick={isFiltered ? clearFilters : openAddBook}
            className="bg-orange-600 hover:bg-orange-700 text-white px-8 py-3 rounded-xl font-bold shadow-lg transition-colors"
          >
            {isFiltered ? 'Clear filters' : 'Add Your First Book'}
          </button>
        </div>
      )}

      {showRecommendations && (
        <RecommendationCarousel
          recommendations={recommendations}
          isRefreshing={isRefreshingRecs}
          canRefresh={books.length > 0}
          onRefresh={() => void refreshRecommendations()}
          onPreview={(rec) => void previewRecommendation(rec)}
          addingBookTitle={addingBookTitle}
        />
      )}
    </div>
  );
}
