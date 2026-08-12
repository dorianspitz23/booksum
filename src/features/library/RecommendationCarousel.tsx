import { useRef } from 'react';
import { BookOpen, ChevronLeft, ChevronRight, Loader2, Sparkles } from 'lucide-react';
import { placeholderCover } from '../../lib/covers';
import type { Recommendation } from '../../lib/ai/recommend';

interface RecommendationCarouselProps {
  recommendations: Recommendation[];
  isRefreshing: boolean;
  canRefresh: boolean;
  onRefresh: () => void;
  onPreview: (rec: Recommendation) => void;
  addingBookTitle: string | null;
}

function coverFallback(rec: Recommendation) {
  return (event: React.SyntheticEvent<HTMLImageElement>) => {
    const target = event.currentTarget;
    target.onerror = null;
    target.src = placeholderCover(rec.title);
  };
}

export function RecommendationCarousel({
  recommendations,
  isRefreshing,
  canRefresh,
  onRefresh,
  onPreview,
  addingBookTitle,
}: RecommendationCarouselProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    const container = scrollContainerRef.current;
    if (!container) return;
    container.scrollBy({ left: direction === 'left' ? -340 : 340, behavior: 'smooth' });
  };

  return (
    <div className="mt-20 pt-12 border-t border-gray-200 dark:border-gray-700/60 animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-serif font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Sparkles className="text-orange-500 fill-orange-500" size={20} />
          Recommended For You{' '}
          {isRefreshing && <Loader2 size={16} className="animate-spin text-gray-300" />}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={onRefresh}
            disabled={isRefreshing || !canRefresh}
            className="px-3 py-2 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-orange-50 dark:hover:bg-orange-950 hover:text-orange-700 dark:hover:text-orange-400 hover:border-orange-200 transition-all active:scale-95 text-xs font-bold uppercase tracking-widest disabled:opacity-40"
            title="Ask Gemini for fresh recommendations"
          >
            Refresh
          </button>
          <button
            onClick={() => scroll('left')}
            className="p-2 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-orange-50 dark:hover:bg-orange-950 hover:text-orange-700 dark:hover:text-orange-400 hover:border-orange-200 transition-all active:scale-95"
            aria-label="Scroll recommendations left"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={() => scroll('right')}
            className="p-2 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-orange-50 dark:hover:bg-orange-950 hover:text-orange-700 dark:hover:text-orange-400 hover:border-orange-200 transition-all active:scale-95"
            aria-label="Scroll recommendations right"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div
        ref={scrollContainerRef}
        role="region"
        aria-label="Recommended books"
        className="flex gap-6 overflow-x-auto pb-24 pt-4 px-4 -mx-4 scroll-smooth snap-x snap-mandatory [&::-webkit-scrollbar]:hidden"
      >
        {recommendations.map((rec) => (
          <div
            key={rec.title}
            className="relative group h-full hover:z-50 focus-within:z-50 min-w-[280px] md:min-w-[320px] snap-center"
          >
            {/* The card itself is the control, so it is reachable by keyboard. */}
            <button
              type="button"
              onClick={() => onPreview(rec)}
              className="w-full h-full text-left bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-100 dark:border-gray-800 flex flex-row gap-4 overflow-hidden shadow-sm group-hover:shadow-none transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
            >
              <span className="w-16 h-24 flex-shrink-0 rounded-lg overflow-hidden shadow-sm bg-gray-100 dark:bg-gray-800 relative block">
                <img
                  src={rec.coverUrl}
                  alt=""
                  onError={coverFallback(rec)}
                  className="w-full h-full object-cover"
                />
              </span>
              <span className="flex flex-col justify-center min-w-0 flex-1">
                <span className="font-bold text-gray-900 dark:text-gray-100 leading-tight truncate pr-2 mb-1 block">
                  {rec.title}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400 mb-2 font-medium block">
                  {rec.author}
                </span>
                <span className="text-[10px] text-gray-600 dark:text-gray-400 line-clamp-2 leading-relaxed mb-3 opacity-80 block">
                  {rec.description}
                </span>
                <span className="mt-auto flex items-center text-[10px] font-black uppercase tracking-widest text-orange-700 dark:text-orange-400 gap-1.5 transition-all">
                  {addingBookTitle === rec.title ? (
                    <>
                      <Loader2 size={12} className="animate-spin" /> Generating...
                    </>
                  ) : (
                    <>
                      <BookOpen size={12} strokeWidth={3} /> Read Summary
                    </>
                  )}
                </span>
              </span>
            </button>

            {/*
              Decorative expanded preview. Shown on hover and on keyboard focus so
              the extra description is not pointer-only. aria-hidden because the
              button above already carries the same information.
            */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-4 -left-4 -right-4 bg-white dark:bg-gray-900 rounded-2xl p-6 border border-orange-100 shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition-all duration-200 z-50 flex flex-col gap-4 scale-95 group-hover:scale-100 group-focus-within:scale-100 origin-center"
              style={{ height: 'auto', minHeight: 'calc(100% + 2rem)' }}
            >
              <div className="flex flex-row gap-5">
                <div className="w-20 h-28 flex-shrink-0 rounded-lg overflow-hidden shadow-md bg-gray-100 dark:bg-gray-800 relative">
                  <img
                    src={rec.coverUrl}
                    alt=""
                    onError={coverFallback(rec)}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex flex-col">
                  <h3 className="font-bold text-gray-900 dark:text-gray-100 text-lg leading-tight mb-1">
                    {rec.title}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 font-medium">
                    {rec.author}
                  </p>
                  <div className="mt-auto flex items-center text-[10px] font-black uppercase tracking-widest text-orange-700 dark:text-orange-400 gap-1.5">
                    {addingBookTitle === rec.title ? (
                      <>
                        <Loader2 size={12} className="animate-spin" /> Generating...
                      </>
                    ) : (
                      <>
                        <BookOpen size={12} strokeWidth={3} /> Read Summary
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed border-t border-gray-50 pt-3">
                {rec.description}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
