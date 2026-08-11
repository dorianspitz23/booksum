
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ViewState, BookInsight, Category, UserProfile, BookStatus } from './types';
import { BookCard } from './components/BookCard';
import { BookDetail } from './components/BookDetail';
import { AddBookModal } from './components/AddBookModal';
import { EReader } from './components/EReader';
import { StatsView } from './components/StatsView';
import { ProfileView } from './components/ProfileView';
import { AudioPlayer, AudioTrack } from './components/AudioPlayer';
import { LoginView } from './components/LoginView';
import { DailyWisdomModal } from './components/DailyWisdomModal';
import { useAuth } from './contexts/AuthContext';
import { Plus, Library, Search, User as UserIcon, BarChart2, Filter, Sparkles, Loader2, BookOpen, ChevronLeft, ChevronRight, CheckCircle, Bookmark, Layers, LogOut } from 'lucide-react';
import { summarizeBook, getAIRecommendations } from './services/geminiService';

const DEFAULT_PROFILE: UserProfile = {
  name: 'Lifelong Learner',
  monthlyGoal: 4,
  joinedAt: new Date().toISOString(),
  bio: 'Passionate about distilling wisdom and applying it to daily life.',
  favoriteVoice: 'Kore'
};

// Used ISBN-based URLs for stability and correctness - kept as fallback
const RECOMMENDED_BOOKS = [
  {
    title: "The Psychology of Money",
    author: "Morgan Housel",
    description: "Timeless lessons on wealth, greed, and happiness. It's about how you behave.",
    coverUrl: "https://covers.openlibrary.org/b/isbn/9780857197689-L.jpg"
  },
  {
    title: "Deep Work",
    author: "Cal Newport",
    description: "Rules for focused success in a distracted world.",
    coverUrl: "https://covers.openlibrary.org/b/isbn/9781455586691-L.jpg"
  },
  {
    title: "Sapiens",
    author: "Yuval Noah Harari",
    description: "A brief history of humankind from the Stone Age to the Silicon Age.",
    coverUrl: "https://covers.openlibrary.org/b/isbn/9780062316097-L.jpg"
  },
  {
    title: "Essentialism",
    author: "Greg McKeown",
    description: "The disciplined pursuit of less. Getting the right things done.",
    coverUrl: "https://covers.openlibrary.org/b/isbn/9780804137386-L.jpg"
  },
  {
    title: "Thinking, Fast and Slow",
    author: "Daniel Kahneman",
    description: "The two systems that drive the way we think. System 1 is fast, intuitive, and emotional.",
    coverUrl: "https://covers.openlibrary.org/b/isbn/9780374275631-L.jpg"
  },
  {
    title: "Man's Search for Meaning",
    author: "Viktor E. Frankl",
    description: "Psychiatrist Viktor Frankl's memoir has riveted generations of readers.",
    coverUrl: "https://covers.openlibrary.org/b/isbn/9780807014271-L.jpg"
  }
];

const App: React.FC = () => {
  const { user, logout, isLoading: authLoading } = useAuth();
  
  const [view, setView] = useState<ViewState>('library');
  const [books, setBooks] = useState<BookInsight[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [selectedBook, setSelectedBook] = useState<BookInsight | null>(null);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [isRefreshingRecs, setIsRefreshingRecs] = useState(false);
  
  // Daily Wisdom State
  const [showDailyWisdom, setShowDailyWisdom] = useState(false);
  const [dailyBook, setDailyBook] = useState<BookInsight | null>(null);
  const wisdomCheckedRef = useRef(false);
  
  // Filtering States
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | BookStatus>('All');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [addingBookTitle, setAddingBookTitle] = useState<string | null>(null);
  
  // Scroll Ref for Recommendations
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Audio Player State
  const [activeAudioTrack, setActiveAudioTrack] = useState<AudioTrack | null>(null);

  // Load from local storage based on User ID
  useEffect(() => {
    if (!user) return;

    const userLibraryKey = `booksum_library_${user.id}`;
    const userProfileKey = `booksum_profile_${user.id}`;
    const userRecsKey = `booksum_recs_${user.id}`;

    const savedLibrary = localStorage.getItem(userLibraryKey);
    if (savedLibrary) {
      setBooks(JSON.parse(savedLibrary));
    } else {
      setBooks([
        {
          id: '1',
          title: 'Atomic Habits',
          author: 'James Clear',
          category: 'Productivity',
          oneSentenceTakeaway: 'Small changes lead to remarkable results through the compounding effect of habits.',
          summary: 'Atomic Habits provides a proven framework for improving every day. James Clear reveals practical strategies that will teach you exactly how to form good habits, break bad ones, and master the tiny behaviors that lead to remarkable results.',
          keyInsights: [
            'Forget about goals, focus on systems instead.',
            'Habits are the compound interest of self-improvement.',
            'The four laws of behavior change: Make it obvious, attractive, easy, and satisfying.',
            'Identity-based habits are more powerful than outcome-based habits.'
          ],
          actionableSteps: [
            'Use implementation intentions: I will [BEHAVIOR] at [TIME] in [LOCATION].',
            'Try habit stacking: After [CURRENT HABIT], I will [NEW HABIT].',
            'Design your environment for success.'
          ],
          coverImageUrl: 'https://covers.openlibrary.org/b/isbn/9780735211292-L.jpg',
          rating: 4.8,
          readingTimeMinutes: 12,
          addedAt: new Date().toISOString(),
          status: 'Finished'
        }
      ]);
    }

    const savedProfile = localStorage.getItem(userProfileKey);
    if (savedProfile) {
      setUserProfile(JSON.parse(savedProfile));
    } else {
      setUserProfile({
        ...DEFAULT_PROFILE,
        name: user.name || DEFAULT_PROFILE.name
      });
    }

    const savedRecs = localStorage.getItem(userRecsKey);
    if (savedRecs) {
      setRecommendations(JSON.parse(savedRecs));
    } else {
      setRecommendations(RECOMMENDED_BOOKS);
    }
  }, [user]);

  // AI Recommendation Update Logic
  useEffect(() => {
    if (!user) return;
    
    // Debounce to prevent rapid firing
    const timer = setTimeout(async () => {
      // Only refresh if we have books, to generate meaningful recs
      if (books.length > 0) {
        try {
          // If we haven't generated custom recs yet (using fallback), or library changed
          // We can just update silently.
          setIsRefreshingRecs(true);
          const newRecs = await getAIRecommendations(books);
          if (newRecs && newRecs.length > 0) {
            setRecommendations(newRecs);
            localStorage.setItem(`booksum_recs_${user.id}`, JSON.stringify(newRecs));
          }
        } catch (e) {
          console.error("Failed to refresh recommendations", e);
        } finally {
          setIsRefreshingRecs(false);
        }
      }
    }, 3000); // 3 second delay after changes to library

    return () => clearTimeout(timer);
  }, [books, user]);

  // Daily Wisdom Logic
  useEffect(() => {
    // Only run if we have books, user is logged in, and haven't checked yet this session
    if (!user || books.length === 0 || wisdomCheckedRef.current) return;

    const key = `booksum_daily_wisdom_${user.id}`;
    const lastSeen = localStorage.getItem(key);
    const today = new Date().toDateString();

    if (lastSeen !== today) {
       // Prefer finished books for wisdom, but fallback to any
       const pool = books.filter(b => b.status === 'Finished');
       const targetPool = pool.length > 0 ? pool : books;
       const randomBook = targetPool[Math.floor(Math.random() * targetPool.length)];
       
       setDailyBook(randomBook);
       
       // Small delay to appear elegantly after app load
       const timer = setTimeout(() => {
         setShowDailyWisdom(true);
       }, 1500);
       
       wisdomCheckedRef.current = true;
       return () => clearTimeout(timer);
    } else {
       wisdomCheckedRef.current = true;
    }
  }, [books, user]);

  // Save to local storage with namespacing
  useEffect(() => {
    if (user) {
      const userLibraryKey = `booksum_library_${user.id}`;
      localStorage.setItem(userLibraryKey, JSON.stringify(books));
    }
  }, [books, user]);

  useEffect(() => {
    if (user) {
      const userProfileKey = `booksum_profile_${user.id}`;
      localStorage.setItem(userProfileKey, JSON.stringify(userProfile));
    }
  }, [userProfile, user]);

  const filteredBooks = useMemo(() => {
    return books.filter(book => {
      const matchesCategory = activeCategory === 'All' || book.category === activeCategory;
      const matchesStatus = statusFilter === 'All' || book.status === statusFilter;
      const matchesSearch = book.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           book.author.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch && matchesStatus;
    }).sort((a, b) => {
      if (a.status === 'Want to Read' && b.status === 'Want to Read') {
        const priorityScore: Record<string, number> = { 'High': 3, 'Medium': 2, 'Low': 1 };
        const scoreA = priorityScore[a.priority || 'Low'];
        const scoreB = priorityScore[b.priority || 'Low'];
        if (scoreA !== scoreB) return scoreB - scoreA;
      }
      return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
    });
  }, [books, activeCategory, searchQuery, statusFilter]);

  const categories = ['All', ...Array.from(new Set(books.map(b => b.category)))];

  const handleAddBook = (book: BookInsight) => {
    setBooks(prev => [book, ...prev]);
  };

  const handlePreviewRecommendation = async (rec: typeof RECOMMENDED_BOOKS[0]) => {
    if (addingBookTitle) return;
    setAddingBookTitle(rec.title);
    try {
      const book = await summarizeBook(rec.title, rec.author);
      setSelectedBook(book);
      setView('book-detail');
    } catch (error) {
      console.error("Failed to preview recommended book", error);
      alert("Failed to open book summary. Please try again.");
    } finally {
      setAddingBookTitle(null);
    }
  };

  const handleDeleteBook = (id: string) => {
    if (confirm('Are you sure you want to remove this book from your library?')) {
      setBooks(prev => prev.filter(b => b.id !== id));
      setView('library');
    }
  };

  const handleUpdateBook = (updatedBook: BookInsight) => {
    setBooks(prev => prev.map(b => b.id === updatedBook.id ? updatedBook : b));
    setSelectedBook(updatedBook);
  };

  const handleBookSelect = (book: BookInsight) => {
    setSelectedBook(book);
    setView('book-detail');
  };

  const handleResetLibrary = () => {
    if (confirm('DANGER: This will permanently delete all books and insights in your library. Continue?')) {
      setBooks([]);
      if (user) {
        localStorage.removeItem(`booksum_library_${user.id}`);
        localStorage.removeItem(`booksum_recs_${user.id}`);
        localStorage.removeItem(`booksum_daily_wisdom_${user.id}`);
      }
      setRecommendations(RECOMMENDED_BOOKS);
      setView('library');
    }
  };

  const handleImportLibrary = (importedBooks: BookInsight[], importedProfile: UserProfile) => {
    const currentBookIds = new Set(books.map(b => b.id));
    const newBooks = importedBooks.filter(b => !currentBookIds.has(b.id));
    setBooks(prev => [...newBooks, ...prev]);
    setUserProfile(prev => ({
       ...prev,
       ...importedProfile,
       name: prev.name 
    }));
  };

  const handlePlayAudio = (track: AudioTrack) => {
    setActiveAudioTrack(track);
  };
  
  const handleCloseWisdom = () => {
    setShowDailyWisdom(false);
    if (user) {
      localStorage.setItem(`booksum_daily_wisdom_${user.id}`, new Date().toDateString());
    }
  };

  const handleOpenWisdomBook = () => {
    if (dailyBook) {
        handleCloseWisdom();
        handleBookSelect(dailyBook);
    }
  };

  const scrollRecommendations = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const { current } = scrollContainerRef;
      const scrollAmount = direction === 'left' ? -340 : 340;
      current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fcfcf9]">
        <Loader2 className="animate-spin text-orange-600" size={40} />
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  return (
    <div className="min-h-screen bg-[#fcfcf9] text-gray-900 selection:bg-orange-100 selection:text-orange-900 pb-20">
      {/* Navigation */}
      {view !== 'e-reader' && (
        <nav className="fixed left-0 top-0 bottom-0 w-20 md:w-64 bg-white border-r border-gray-100 hidden sm:flex flex-col z-40 transition-all">
          <div 
            className="p-6 md:p-8 flex items-center gap-3 group cursor-pointer" 
            onClick={() => setView('library')}
          >
            <div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center text-white font-serif font-bold italic shadow-lg shadow-orange-100 group-hover:rotate-6 transition-transform">
              B
            </div>
            <h1 className="text-2xl font-serif font-bold text-orange-700 italic hidden md:block tracking-tighter">BookSum</h1>
          </div>
          
          <div className="flex-grow px-4 space-y-2">
            <button 
              onClick={() => setView('library')}
              className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all ${view === 'library' ? 'bg-orange-50 text-orange-700' : 'text-gray-400 hover:text-gray-900 hover:bg-gray-50'}`}
            >
              <Library size={24} />
              <span className="font-semibold hidden md:block">My Library</span>
            </button>
            <button 
              onClick={() => setView('stats')}
              className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all ${view === 'stats' ? 'bg-orange-50 text-orange-700' : 'text-gray-400 hover:text-gray-900 hover:bg-gray-50'}`}
            >
              <BarChart2 size={24} />
              <span className="font-semibold hidden md:block">Stats</span>
            </button>
            <button 
              onClick={() => setView('profile')}
              className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all ${view === 'profile' ? 'bg-orange-50 text-orange-700' : 'text-gray-400 hover:text-gray-900 hover:bg-gray-50'}`}
            >
              <UserIcon size={24} />
              <span className="font-semibold hidden md:block">My Profile</span>
            </button>
          </div>

          <div className="px-4 pb-4">
             <div className="p-3 mb-4 rounded-xl bg-gray-50 border border-gray-100 flex items-center gap-3">
                <img 
                  src={user.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}`} 
                  alt={user.name} 
                  className="w-8 h-8 rounded-full bg-orange-200"
                />
                <div className="hidden md:block overflow-hidden">
                  <p className="text-xs font-bold text-gray-900 truncate">{user.name}</p>
                  <p className="text-[10px] text-gray-500 truncate">{user.email}</p>
                </div>
             </div>
             <button 
                onClick={logout}
                className="w-full flex items-center justify-center gap-2 p-3 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all text-sm font-semibold"
             >
               <LogOut size={18} />
               <span className="hidden md:block">Sign Out</span>
             </button>
          </div>

          <div className="p-4 pt-0">
            <button 
              onClick={() => setView('adding-book')}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white rounded-2xl p-4 flex items-center justify-center gap-3 shadow-lg shadow-orange-100 transition-all active:scale-95"
            >
              <Plus size={24} />
              <span className="font-bold hidden md:block">Add Book</span>
            </button>
          </div>
        </nav>
      )}

      {/* Main Content Area */}
      <main className={`${view !== 'e-reader' ? 'sm:ml-20 md:ml-64' : ''} min-h-screen p-6 sm:p-10 lg:p-16 ${activeAudioTrack ? 'pb-32' : ''}`}>
        {view === 'library' ? (
          <div className="max-w-7xl mx-auto space-y-10">
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div>
                <span className="text-orange-600 font-bold uppercase tracking-widest text-xs mb-2 block">Welcome, {user.name.split(' ')[0]}</span>
                <h1 className="text-4xl md:text-5xl font-serif font-bold text-gray-900">Your Library</h1>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-orange-500 transition-colors" size={20} />
                  <input 
                    type="text" 
                    placeholder="Search your titles..." 
                    className="pl-12 pr-6 py-4 bg-white border border-gray-100 rounded-2xl w-full md:w-80 shadow-sm focus:ring-2 focus:ring-orange-500 outline-none transition-all text-gray-900"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            </header>

            {/* Filters Container */}
            <div className="flex flex-col space-y-4">
               {/* Status Filters */}
               <div className="flex bg-gray-100 p-1.5 rounded-2xl w-fit">
                 <button 
                   onClick={() => setStatusFilter('All')}
                   className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${statusFilter === 'All' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                 >
                   <Layers size={16} /> All
                 </button>
                 <button 
                   onClick={() => setStatusFilter('Finished')}
                   className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${statusFilter === 'Finished' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-emerald-700'}`}
                 >
                   <CheckCircle size={16} /> Finished
                 </button>
                 <button 
                   onClick={() => setStatusFilter('Want to Read')}
                   className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${statusFilter === 'Want to Read' ? 'bg-white text-amber-700 shadow-sm' : 'text-gray-500 hover:text-amber-700'}`}
                 >
                   <Bookmark size={16} /> Want to Read
                 </button>
               </div>

               {/* Category Filters */}
               <div className="flex items-center gap-4 overflow-x-auto pb-4 scrollbar-hide">
                 <div className="flex items-center gap-2 pr-4 border-r border-gray-200 text-gray-400 flex-shrink-0">
                   <Filter size={18} />
                   <span className="text-sm font-bold uppercase tracking-tighter">Topic</span>
                 </div>
                 {categories.map(cat => (
                   <button
                     key={cat}
                     onClick={() => setActiveCategory(cat)}
                     className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all border ${
                        activeCategory === cat 
                          ? 'bg-gray-900 text-white border-gray-900 shadow-lg' 
                          : 'bg-white text-gray-500 border-gray-100 hover:bg-gray-50 hover:border-gray-200'
                     }`}
                   >
                     {cat}
                   </button>
                 ))}
               </div>
            </div>

            {filteredBooks.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                {filteredBooks.map(book => (
                  <BookCard 
                    key={book.id} 
                    book={book} 
                    onClick={handleBookSelect}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                  <Library size={40} className="text-gray-300" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Your library is quiet</h3>
                <p className="text-gray-500 max-w-sm mb-8">
                  {statusFilter !== 'All' 
                     ? `You don't have any books marked as "${statusFilter}" that match your filters.` 
                     : "Start adding your favorite books and let AI extract the wisdom for you."}
                </p>
                {!searchQuery && (
                  <button 
                    onClick={() => setView('adding-book')}
                    className="bg-orange-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg"
                  >
                    Add Your First Book
                  </button>
                )}
              </div>
            )}

            {recommendations.length > 0 && !searchQuery && statusFilter === 'All' && activeCategory === 'All' && (
              <div className="mt-20 pt-12 border-t border-gray-200/60 animate-in fade-in slide-in-from-bottom-8 duration-700">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-serif font-bold text-gray-900 flex items-center gap-2">
                    <Sparkles className="text-orange-500 fill-orange-500" size={20} /> 
                    Recommended For You {isRefreshingRecs && <Loader2 size={16} className="animate-spin text-gray-300" />}
                  </h2>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => scrollRecommendations('left')}
                      className="p-2 rounded-full border border-gray-200 bg-white text-gray-600 hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200 transition-all active:scale-95"
                      aria-label="Scroll left"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <button 
                      onClick={() => scrollRecommendations('right')}
                      className="p-2 rounded-full border border-gray-200 bg-white text-gray-600 hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200 transition-all active:scale-95"
                      aria-label="Scroll right"
                    >
                      <ChevronRight size={20} />
                    </button>
                  </div>
                </div>
                
                {/* Carousel Container - increased bottom padding to avoid clipping hover cards */}
                <div 
                  ref={scrollContainerRef}
                  className="flex gap-6 overflow-x-auto pb-24 pt-4 px-4 -mx-4 scroll-smooth snap-x snap-mandatory [&::-webkit-scrollbar]:hidden"
                >
                  {recommendations.map((rec) => (
                    <div 
                      key={rec.title}
                      className="relative group h-full hover:z-50 min-w-[280px] md:min-w-[320px] snap-center"
                    >
                      {/* Base Card (Visible by default) */}
                      <div
                        className="h-full bg-white rounded-2xl p-4 border border-gray-100 flex flex-row gap-4 overflow-hidden cursor-pointer shadow-sm group-hover:shadow-none transition-shadow"
                        onClick={() => handlePreviewRecommendation(rec)}
                      >
                        <div className="w-16 h-24 flex-shrink-0 rounded-lg overflow-hidden shadow-sm bg-gray-100 relative">
                           <img 
                              src={rec.coverUrl} 
                              alt={rec.title} 
                              onError={(e) => {
                                  const target = e.currentTarget as HTMLImageElement;
                                  target.onerror = null;
                                  target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(rec.title)}&background=f3f4f6&color=9ca3af&bold=true`;
                              }}
                              className="w-full h-full object-cover" 
                           />
                        </div>
                        <div className="flex flex-col justify-center min-w-0 flex-1">
                          <h3 className="font-bold text-gray-900 leading-tight truncate pr-2 mb-1">{rec.title}</h3>
                          <p className="text-xs text-gray-500 mb-2 font-medium">{rec.author}</p>
                          <p className="text-[10px] text-gray-600 line-clamp-2 leading-relaxed mb-3 opacity-80">{rec.description}</p>
                          
                          <div className="mt-auto flex items-center text-[10px] font-black uppercase tracking-widest text-orange-600 gap-1.5 transition-all">
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

                      {/* Hover Preview Card (Overlay) */}
                      <div 
                        onClick={() => handlePreviewRecommendation(rec)}
                        className="absolute -top-4 -left-4 -right-4 bg-white rounded-2xl p-6 border border-orange-100 shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 cursor-pointer flex flex-col gap-4 scale-95 group-hover:scale-100 origin-center"
                        style={{ height: 'auto', minHeight: 'calc(100% + 2rem)' }}
                      >
                         <div className="flex flex-row gap-5">
                             <div className="w-20 h-28 flex-shrink-0 rounded-lg overflow-hidden shadow-md bg-gray-100 relative">
                                <img 
                                   src={rec.coverUrl} 
                                   alt={rec.title} 
                                   onError={(e) => {
                                       const target = e.currentTarget as HTMLImageElement;
                                       target.onerror = null;
                                       target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(rec.title)}&background=f3f4f6&color=9ca3af&bold=true`;
                                   }}
                                   className="w-full h-full object-cover" 
                                />
                             </div>
                             <div className="flex flex-col">
                               <h3 className="font-bold text-gray-900 text-lg leading-tight mb-1">{rec.title}</h3>
                               <p className="text-sm text-gray-500 mb-3 font-medium">{rec.author}</p>
                               <div className="mt-auto flex items-center text-[10px] font-black uppercase tracking-widest text-orange-600 gap-1.5">
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
                         <div className="text-sm text-gray-600 leading-relaxed border-t border-gray-50 pt-3">
                            {rec.description}
                         </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : view === 'stats' ? (
          <StatsView books={books} onBookClick={handleBookSelect} />
        ) : view === 'profile' ? (
          <ProfileView 
            profile={userProfile} 
            onUpdate={setUserProfile}
            books={books}
            onResetLibrary={handleResetLibrary}
            onImportLibrary={handleImportLibrary}
          />
        ) : selectedBook && view === 'book-detail' ? (
          <BookDetail 
            book={selectedBook} 
            onBack={() => setView('library')}
            onDelete={handleDeleteBook}
            onUpdate={handleUpdateBook}
            onOpenReader={() => setView('e-reader')}
            isPreview={!books.some(b => b.id === selectedBook.id)}
            onAdd={() => handleAddBook(selectedBook)}
            onPlayAudio={handlePlayAudio}
          />
        ) : selectedBook && view === 'e-reader' ? (
          <EReader 
            book={selectedBook} 
            onClose={() => setView('book-detail')} 
            onPlayAudio={handlePlayAudio}
            hasAudioPlayer={!!activeAudioTrack}
          />
        ) : null}
      </main>

      {view !== 'e-reader' && (
        <button 
          onClick={() => setView('adding-book')}
          className="sm:hidden fixed bottom-6 right-6 w-14 h-14 bg-orange-600 rounded-full flex items-center justify-center text-white shadow-2xl z-50 active:scale-90 transition-transform"
        >
          <Plus size={28} />
        </button>
      )}

      {view === 'adding-book' && (
        <AddBookModal 
          onClose={() => setView('library')}
          onAdd={handleAddBook}
        />
      )}

      {/* Global Audio Player */}
      {activeAudioTrack && (
        <AudioPlayer 
          track={activeAudioTrack} 
          onClose={() => setActiveAudioTrack(null)} 
        />
      )}

      {/* Daily Wisdom Modal */}
      {showDailyWisdom && dailyBook && (
        <DailyWisdomModal 
          book={dailyBook}
          onClose={handleCloseWisdom}
          onReadMore={handleOpenWisdomBook}
        />
      )}
    </div>
  );
};

export default App;
