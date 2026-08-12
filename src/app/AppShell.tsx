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
import { ShellContext } from './ShellContext';
import type { ShellApi } from './ShellContext';
import { toAiError } from '../lib/ai/errors';
import { ToastHost } from '../components/ui/Toast';
import type { Book, Summary } from '../types';

const NAV_ITEMS = [
  { to: '/', label: 'My Library', icon: Library, end: true },
  { to: '/review', label: 'Review', icon: BrainCircuit, end: false },
  { to: '/stats', label: 'Stats', icon: BarChart2, end: false },
  { to: '/profile', label: 'My Profile', icon: UserIcon, end: false },
];

export function AppShell() {
  const { profile, signOut } = useProfile();
  const { books, addBook, getSummary } = useLibrary();
  const location = useLocation();
  const navigate = useNavigate();

  const [activeAudioTrack, setActiveAudioTrack] = useState<AudioTrack | null>(null);
  const [showAddBook, setShowAddBook] = useState(false);
  const [showKeyDialog, setShowKeyDialog] = useState(false);

  const [showDailyWisdom, setShowDailyWisdom] = useState(false);
  const [dailyBook, setDailyBook] = useState<Book | null>(null);
  const [dailySummary, setDailySummary] = useState<Summary | undefined>(undefined);
  const wisdomCheckedRef = useRef(false);

  // The reader is a full-bleed view, so the chrome steps aside for it.
  const isReader = location.pathname.endsWith('/read');

  const handleAiError = useCallback((error: unknown): string => {
    const aiError = toAiError(error);
    if (aiError.kind === 'missing-key' || aiError.kind === 'invalid-key') {
      // Close whatever asked for the key first: two aria-modal dialogs on screen
      // means two competing focus traps.
      setShowAddBook(false);
      setShowKeyDialog(true);
    }
    return aiError.message;
  }, []);

  useEffect(() => {
    if (!profile || books.length === 0 || wisdomCheckedRef.current) return;

    const key = `booksum_daily_wisdom_${profile.id}`;
    const lastSeen = localStorage.getItem(key);
    const today = new Date().toDateString();
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
      playAudio: setActiveAudioTrack,
      hasAudioPlayer: activeAudioTrack !== null,
      openAddBook: () => setShowAddBook(true),
      handleAiError,
    }),
    [activeAudioTrack, handleAiError],
  );

  const closeWisdom = () => {
    setShowDailyWisdom(false);
    if (profile) {
      localStorage.setItem(`booksum_daily_wisdom_${profile.id}`, new Date().toDateString());
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
                  <Icon size={24} />
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
          className={`${isReader ? '' : 'sm:ml-20 md:ml-64'} min-h-screen p-6 sm:p-10 lg:p-16 ${
            activeAudioTrack ? 'pb-32' : ''
          }`}
        >
          <Outlet />
        </main>

        {!isReader && (
          <button
            onClick={() => setShowAddBook(true)}
            aria-label="Add book"
            className="sm:hidden fixed bottom-6 right-6 w-14 h-14 bg-orange-600 rounded-full flex items-center justify-center text-white shadow-2xl z-50 active:scale-90 transition-transform"
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

        {activeAudioTrack && (
          <AudioPlayer track={activeAudioTrack} onClose={() => setActiveAudioTrack(null)} />
        )}

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
