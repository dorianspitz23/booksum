import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { BarChart2, BrainCircuit, Library, LogOut, Plus, User as UserIcon } from 'lucide-react';
import { AudioPlayer } from '../components/AudioPlayer';
import type { AudioTrack } from '../components/AudioPlayer';
import { AddBookModal } from '../components/AddBookModal';
import { DailyWisdomModal } from '../components/DailyWisdomModal';
import { ApiKeyDialog } from '../features/settings/ApiKeyDialog';
import { useProfile } from '../features/profile/ProfileContext';
import { useLibrary } from '../features/library/useLibrary';
import { useReviewQueue } from '../features/review/useReviewQueue';
import { ShellContext } from './ShellContext';
import type { ShellApi } from './ShellContext';
import { keyDialog, reportAiError } from '../features/settings/keyDialog';
import { ToastHost } from '../components/ui/Toast';
import { dailyWisdomKey } from '../lib/storageKeys';
import { localDayStamp } from '../lib/stats';
import type { Book, Summary } from '../types';

const NAV_ITEMS = [
  { to: '/', label: 'My Library', icon: Library, end: true },
  { to: '/review', label: 'Review', icon: BrainCircuit, end: false },
  { to: '/stats', label: 'Stats', icon: BarChart2, end: false },
  { to: '/profile', label: 'My Profile', icon: UserIcon, end: false },
];

/**
 * The due count was computed inside the review queue and never left it, so the
 * only way to discover that anything was due was to visit the Review tab — which
 * is the opposite of how spaced repetition is meant to work.
 */
function DueBadge({ count }: { count: number }) {
  return (
    <span
      aria-label={`${count} card${count === 1 ? '' : 's'} due`}
      className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-orange-600 text-white text-[10px] font-black flex items-center justify-center shadow"
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

export function AppShell() {
  const { profile, signOut } = useProfile();
  const { books, addBook, getSummary } = useLibrary();
  const { remaining: dueCount } = useReviewQueue();

  // The theme is applied in App, above this shell, so it also covers the loading
  // screen and the profile picker -- neither of which renders inside the shell.
  const location = useLocation();
  const navigate = useNavigate();

  const [activeAudioTrack, setActiveAudioTrack] = useState<AudioTrack | null>(null);

  /**
   * Every narration created a blob URL that nothing ever revoked, so each play
   * pinned another full WAV in memory for the life of the page. This is the only
   * place that owns a track's lifetime, so it is the only place that can free it.
   */
  const playAudio = useCallback((track: AudioTrack) => {
    setActiveAudioTrack((previous) => {
      if (previous && previous.src !== track.src && previous.src.startsWith('blob:')) {
        URL.revokeObjectURL(previous.src);
      }
      return track;
    });
  }, []);

  const stopAudio = useCallback(() => {
    setActiveAudioTrack((previous) => {
      if (previous?.src.startsWith('blob:')) URL.revokeObjectURL(previous.src);
      return null;
    });
  }, []);
  const [showAddBook, setShowAddBook] = useState(false);
  const [showKeyDialog, setShowKeyDialog] = useState(false);

  const [showDailyWisdom, setShowDailyWisdom] = useState(false);
  const [dailyBook, setDailyBook] = useState<Book | null>(null);
  const [dailySummary, setDailySummary] = useState<Summary | undefined>(undefined);
  const wisdomCheckedRef = useRef(false);

  // The reader is a full-bleed view, so the chrome steps aside for it.
  const isReader = location.pathname.endsWith('/read');

  /**
   * The shell owns the dialog, but not the decision to show it. Any call site
   * can now ask via `reportAiError`, including the three that were never given
   * the prop and so could only ever show a toast telling the user to add a key
   * with nowhere to add one.
   */
  useEffect(
    () =>
      keyDialog.subscribe(() => {
        // Close whatever asked for the key first: two aria-modal dialogs on
        // screen means two competing focus traps.
        setShowAddBook(false);
        setShowKeyDialog(true);
      }),
    [],
  );

  const handleAiError = useCallback((error: unknown): string => reportAiError(error), []);

  useEffect(() => {
    if (!profile || books.length === 0 || wisdomCheckedRef.current) return;

    const key = dailyWisdomKey(profile.id);
    const lastSeen = localStorage.getItem(key);
    const today = localDayStamp();
    wisdomCheckedRef.current = true;

    if (lastSeen === today) return;

    const pool = books.filter((b) => b.status === 'Finished');
    const targetPool = pool.length > 0 ? pool : books;
    const randomBook = targetPool[Math.floor(Math.random() * targetPool.length)];
    if (!randomBook) return;

    setDailyBook(randomBook);
    void getSummary(randomBook.id).then(setDailySummary);

    const timer = setTimeout(() => setShowDailyWisdom(true), 1500);
    return () => clearTimeout(timer);
  }, [books, profile, getSummary]);

  const shellApi = useMemo<ShellApi>(
    () => ({
      playAudio,
      hasAudioPlayer: activeAudioTrack !== null,
      openAddBook: () => setShowAddBook(true),
      handleAiError,
    }),
    [activeAudioTrack, handleAiError, playAudio],
  );

  const closeWisdom = () => {
    setShowDailyWisdom(false);
    if (profile) {
      localStorage.setItem(dailyWisdomKey(profile.id), localDayStamp());
    }
  };

  if (!profile) return null;

  return (
    <ShellContext.Provider value={shellApi}>
      <div className="min-h-screen bg-parchment dark:bg-night text-gray-900 dark:text-gray-100 selection:bg-orange-100 dark:selection:bg-orange-950 selection:text-orange-900 pb-20">
        {!isReader && (
          <nav
            aria-label="Main"
            className="fixed left-0 top-0 bottom-0 w-20 md:w-64 bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 hidden sm:flex flex-col z-40 transition-all"
          >
            <NavLink to="/" className="p-6 md:p-8 flex items-center gap-3 group">
              <span className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center text-white font-serif font-bold italic shadow-lg shadow-orange-100 group-hover:rotate-6 transition-transform">
                B
              </span>
              <span className="text-2xl font-serif font-bold text-orange-700 dark:text-orange-400 italic hidden md:block tracking-tighter">
                BookSum
              </span>
            </NavLink>

            <div className="flex-grow px-4 space-y-2">
              {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `w-full flex items-center gap-4 p-4 rounded-2xl transition-all ${
                      isActive
                        ? 'bg-orange-50 dark:bg-orange-950 text-orange-700 dark:text-orange-400'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`
                  }
                >
                  <span className="relative shrink-0">
                    <Icon size={24} />
                    {to === '/review' && dueCount > 0 && <DueBadge count={dueCount} />}
                  </span>
                  <span className="font-semibold hidden md:block">{label}</span>
                </NavLink>
              ))}
            </div>

            <div className="px-4 pb-4">
              <div className="p-3 mb-4 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-800 flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-400 text-xs font-bold flex items-center justify-center shrink-0">
                  {profile.name.charAt(0).toUpperCase()}
                </span>
                <div className="hidden md:block overflow-hidden">
                  <p className="text-xs font-bold text-gray-900 dark:text-gray-100 truncate">
                    {profile.name}
                  </p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                    {profile.bio}
                  </p>
                </div>
              </div>
              <button
                onClick={signOut}
                className="w-full flex items-center justify-center gap-2 p-3 text-gray-500 dark:text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all text-sm font-semibold"
              >
                <LogOut size={18} />
                <span className="hidden md:block">Switch profile</span>
              </button>
            </div>

            <div className="p-4 pt-0">
              <button
                onClick={() => setShowAddBook(true)}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white rounded-2xl p-4 flex items-center justify-center gap-3 shadow-lg shadow-orange-100 transition-all active:scale-95"
              >
                <Plus size={24} />
                <span className="font-bold hidden md:block">Add Book</span>
              </button>
            </div>
          </nav>
        )}

        <main
          className={`${isReader ? '' : 'sm:ml-20 md:ml-64 pb-24 sm:pb-0'} min-h-screen p-6 sm:p-10 lg:p-16 ${
            activeAudioTrack ? 'pb-32' : ''
          }`}
        >
          <Outlet />
        </main>

        {/*
          Below sm the sidebar is hidden and, until this existed, nothing replaced
          it: /review, /stats and /profile were simply unreachable on a phone,
          along with switching profiles. The whole spaced-repetition feature did
          not exist on mobile.
        */}
        {!isReader && (
          <nav
            aria-label="Main"
            className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 flex items-stretch pb-[env(safe-area-inset-bottom)]"
          >
            {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex-1 flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-bold transition-colors ${
                    isActive
                      ? 'text-orange-700 dark:text-orange-400'
                      : 'text-gray-400 dark:text-gray-500'
                  }`
                }
              >
                <span className="relative">
                  <Icon size={22} />
                  {to === '/review' && dueCount > 0 && <DueBadge count={dueCount} />}
                </span>
                {label}
              </NavLink>
            ))}
          </nav>
        )}

        {!isReader && (
          <button
            onClick={() => setShowAddBook(true)}
            aria-label="Add book"
            className="sm:hidden fixed bottom-20 right-6 w-14 h-14 bg-orange-600 rounded-full flex items-center justify-center text-white shadow-2xl z-50 active:scale-90 transition-transform"
          >
            <Plus size={28} />
          </button>
        )}

        {showAddBook && (
          <AddBookModal
            onClose={() => setShowAddBook(false)}
            onAdd={async (draft, options) => {
              const created = await addBook(draft, options);
              void navigate(`/book/${created.id}`);
            }}
            onAiError={handleAiError}
          />
        )}

        {activeAudioTrack && <AudioPlayer track={activeAudioTrack} onClose={stopAudio} />}

        {showKeyDialog && <ApiKeyDialog onClose={() => setShowKeyDialog(false)} />}

        {showDailyWisdom && dailyBook && (
          <DailyWisdomModal
            book={dailyBook}
            summary={dailySummary}
            onClose={closeWisdom}
            onReadMore={() => {
              closeWisdom();
              void navigate(`/book/${dailyBook.id}`);
            }}
          />
        )}

        <ToastHost />
      </div>
    </ShellContext.Provider>
  );
}
