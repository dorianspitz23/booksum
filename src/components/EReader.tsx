import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { Book, Summary, VoiceName } from '../types';
import { READER_FONT_SIZE, READER_THEME } from '../lib/storageKeys';
import {
  ChevronLeft,
  ChevronRight,
  X,
  Headphones,
  Type,
  Moon,
  Sun,
  Book as BookIcon,
} from 'lucide-react';
import { getOrCreateNarration } from '../lib/ai/narration';
import { toast } from './ui/toastStore';
import { reportAiError } from '../features/settings/keyDialog';
import { useFocusTrap } from './ui/useFocusTrap';
import type { AudioTrack } from './AudioPlayer';

interface EReaderProps {
  book: Book;
  summary: Summary | undefined;
  voice: VoiceName;
  onClose: () => void;
  onPlayAudio: (track: AudioTrack) => void;
  hasAudioPlayer?: boolean;
  /** Persists the section the reader is on, so it reopens where it left off. */
  onProgress?: (sectionIndex: number) => void;
}

type Theme = 'light' | 'sepia' | 'dark';
type FontSize = 'text-base' | 'text-lg' | 'text-xl' | 'text-2xl';

const THEMES: readonly Theme[] = ['light', 'sepia', 'dark'];
const FONT_SIZES: readonly FontSize[] = ['text-base', 'text-lg', 'text-xl', 'text-2xl'];

/**
 * With nothing stored, the reader follows whatever the app is currently showing
 * — opening a reader from a dark app used to mean a full-screen white page.
 * Once the user picks a reader theme it is theirs, including choosing light
 * inside a dark app, which is why this only ever supplies the initial value.
 */
function readInitialReaderTheme(): Theme {
  const stored = localStorage.getItem(READER_THEME);
  if (stored && THEMES.includes(stored as Theme)) return stored as Theme;
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

function readInitialFontSize(): FontSize {
  const stored = localStorage.getItem(READER_FONT_SIZE);
  return stored && FONT_SIZES.includes(stored as FontSize) ? (stored as FontSize) : 'text-lg';
}

/**
 * Text Formatting Utilities
 */
const formatInline = (text: string) => {
  return text.split(/(\*\*.*?\*\*|\*.*?\*)/g).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-bold inherit-color">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return (
        <em key={i} className="italic opacity-90">
          {part.slice(1, -1)}
        </em>
      );
    }
    return part;
  });
};

const RenderFormattedContent: React.FC<{ content: string; isFirstPage: boolean; theme: Theme }> = ({
  content,
  isFirstPage,
  theme,
}) => {
  const lines = content.split('\n');
  const accentColor = theme === 'dark' ? 'text-orange-400' : 'text-orange-700';
  const headingColor = theme === 'dark' ? 'text-gray-100' : 'text-gray-900';
  const dropCapColor = theme === 'dark' ? 'text-orange-500' : 'text-orange-700';

  return (
    <div className="space-y-6 max-w-none">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return null;

        // Headers
        if (trimmed.startsWith('#')) {
          const level = (trimmed.match(/^#+/) || [''])[0].length;
          const text = trimmed.replace(/^#+\s*/, '');

          if (level === 1)
            return (
              <h1
                key={idx}
                className={`text-4xl md:text-5xl font-serif font-bold ${headingColor} mt-12 mb-8 leading-[1.15]`}
              >
                {text}
              </h1>
            );
          if (level === 2)
            return (
              <h2
                key={idx}
                className={`text-3xl font-serif font-bold ${headingColor} mt-10 mb-6 leading-tight border-b ${theme === 'dark' ? 'border-gray-800' : 'border-gray-200/60'} pb-2`}
              >
                {text}
              </h2>
            );
          return (
            <h3
              key={idx}
              className={`text-xl font-serif font-bold ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'} mt-8 mb-4`}
            >
              {text}
            </h3>
          );
        }

        // Blockquotes
        if (trimmed.startsWith('>')) {
          const text = trimmed.replace(/^>\s*/, '');
          return (
            <blockquote
              key={idx}
              className={`pl-6 border-l-4 ${theme === 'dark' ? 'border-orange-900 bg-orange-900/10' : 'border-orange-200 bg-orange-50'} py-2 my-6 italic rounded-r-lg`}
            >
              {formatInline(text)}
            </blockquote>
          );
        }

        // List Items
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          const text = trimmed.replace(/^[-*]\s+/, '');
          return (
            <div key={idx} className="flex gap-4 ml-2 mb-3">
              <span
                className={`flex-shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full ${theme === 'dark' ? 'bg-orange-500' : 'bg-orange-400'}`}
              />
              <p className="leading-relaxed opacity-90">{formatInline(text)}</p>
            </div>
          );
        }

        // Numbered Lists
        if (/^\d+\./.test(trimmed)) {
          const [num, ...rest] = trimmed.split('.');
          return (
            <div key={idx} className="flex gap-4 ml-1 mb-4">
              <span className={`font-serif font-bold ${accentColor}`}>{num}.</span>
              <p className="leading-relaxed opacity-90">{formatInline(rest.join('.').trim())}</p>
            </div>
          );
        }

        // Standard Paragraphs with Drop Cap
        if (isFirstPage && idx === 0 && !trimmed.startsWith('#')) {
          const firstChar = trimmed.charAt(0);
          const rest = trimmed.slice(1);
          return (
            <p key={idx} className="leading-relaxed mb-6 opacity-95">
              <span
                className={`float-left text-[5rem] font-serif font-bold ${dropCapColor} mr-4 mt-[-0.2em] leading-[0.8]`}
              >
                {firstChar}
              </span>
              {formatInline(rest)}
            </p>
          );
        }

        return (
          <p key={idx} className="leading-relaxed mb-6 opacity-95">
            {formatInline(trimmed)}
          </p>
        );
      })}
    </div>
  );
};

export const EReader: React.FC<EReaderProps> = ({
  book,
  summary,
  voice,
  onClose,
  onPlayAudio,
  hasAudioPlayer,
  onProgress,
}) => {
  // Resumes where the reader was left. Clamped when the sections are known,
  // since a regenerated summary can be shorter than the one last read.
  const [currentPage, setCurrentPage] = useState(book.lastReadSection ?? 0);
  // Both used to be hardcoded, so every open reset the reader to light text-lg
  // however the last session was left — and opening it from a dark app threw a
  // full-screen white page at someone reading at night. The initial theme now
  // follows the app when nothing has been chosen, and either choice sticks.
  const [theme, setTheme] = useState<Theme>(readInitialReaderTheme);
  const [fontSize, setFontSize] = useState<FontSize>(readInitialFontSize);
  const [showSettings, setShowSettings] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);

  useEffect(() => {
    localStorage.setItem(READER_THEME, theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(READER_FONT_SIZE, fontSize);
  }, [fontSize]);

  const contentRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Pagination Logic
  const pages = useMemo(() => {
    if (!summary?.detailedSummary) return ['No content available.'];
    // Split by major headers (##) to create distinct "Chapters" or "Sections"
    const sections = summary.detailedSummary
      .split(/(?=## )/g)
      .map((s) => s.trim())
      .filter(Boolean);
    return sections;
  }, [summary?.detailedSummary]);

  /**
   * Clamped here rather than corrected in an effect. A regenerated summary can
   * have fewer sections than the one last read, and effects run *after* render —
   * so a stored index past the end dereferenced a missing section and threw
   * before any correction could run.
   */
  const page = pages.length > 0 ? Math.min(currentPage, pages.length - 1) : 0;

  // Scroll to top on page change
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [page]);

  // Persisted on change rather than on close, so closing the tab keeps the spot.
  useEffect(() => {
    if (pages.length > 0 && page !== (book.lastReadSection ?? 0)) {
      onProgress?.(page);
    }
  }, [page, pages.length, book.lastReadSection, onProgress]);

  /**
   * The reader covers the whole viewport, so it is a modal surface in every way
   * that matters to the user — but it had no Escape handler and no focus trap,
   * so the only way out was clicking one specific icon, and Tab wandered off
   * into the page underneath that the reader was covering.
   */
  useFocusTrap(panelRef, { active: true, onClose });

  /**
   * Arrow keys turn pages, which is the first thing anyone who has used an
   * e-reader will try. Ignored while focus is in a field, so typing still works.
   */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable === true
      ) {
        return;
      }

      if (event.key === 'ArrowRight')
        setCurrentPage((page) => Math.min(pages.length - 1, page + 1));
      if (event.key === 'ArrowLeft') setCurrentPage((page) => Math.max(0, page - 1));
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [pages.length]);

  const handlePlayAudio = async () => {
    if (!summary) return;
    setIsGeneratingAudio(true);
    try {
      const wavBlob = await getOrCreateNarration(book, summary, 'long', voice);

      onPlayAudio({
        src: URL.createObjectURL(wavBlob),
        title: book.title,
        author: book.author,
        coverUrl: book.coverImageUrl,
      });
    } catch (error) {
      toast.error(reportAiError(error));
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const nextPage = () => setCurrentPage((p) => Math.min(pages.length - 1, p + 1));
  const prevPage = () => setCurrentPage((p) => Math.max(0, p - 1));

  // Theme Styles Configuration
  const themeStyles = {
    light: 'bg-[#fcfcf9] text-slate-800 selection:bg-orange-200',
    sepia: 'bg-[#f4ecd8] text-[#433422] selection:bg-[#dcd1b5]',
    dark: 'bg-[#1a1a1a] text-[#d4d4d4] selection:bg-orange-900',
  };

  const uiColors = {
    light: {
      border: 'border-slate-200',
      secondary: 'text-slate-400',
      hover: 'hover:bg-slate-100',
      popover: 'bg-white',
    },
    sepia: {
      border: 'border-[#e0d6c0]',
      secondary: 'text-[#8f806a]',
      hover: 'hover:bg-[#e8dec7]',
      popover: 'bg-[#fdf6e3]',
    },
    dark: {
      border: 'border-white/10',
      secondary: 'text-white/40',
      hover: 'hover:bg-white/10',
      popover: 'bg-[#252525]',
    },
  };

  const activeUI = uiColors[theme];

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Reading ${book.title}`}
      className={`fixed inset-0 z-50 flex flex-col transition-colors duration-500 ease-in-out ${themeStyles[theme]} ${hasAudioPlayer ? 'pb-24 md:pb-28' : ''}`}
    >
      {/* --- Top Navigation Bar --- */}
      <header
        className={`h-16 px-4 md:px-8 flex items-center justify-between border-b ${activeUI.border} backdrop-blur-sm z-20 transition-colors`}
      >
        <div className="flex items-center gap-4 w-1/3">
          <button
            onClick={onClose}
            className={`p-2 rounded-full transition-colors ${activeUI.hover} group`}
            title="Close Reader"
          >
            <X size={24} className="opacity-60 group-hover:opacity-100" />
          </button>
        </div>

        <div className="flex-1 flex justify-center">
          <span className="font-serif font-bold text-sm md:text-lg opacity-90 line-clamp-1">
            {book.title}
          </span>
        </div>

        <div className="flex items-center justify-end gap-3 w-1/3">
          {/* Audio Player - Prominent Button */}
          <button
            onClick={() => void handlePlayAudio()}
            disabled={isGeneratingAudio}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold tracking-wide transition-all shadow-md hover:shadow-lg active:scale-95 ${
              theme === 'sepia'
                ? 'bg-[#433422] text-[#f4ecd8] hover:bg-[#5c4b35]'
                : theme === 'dark'
                  ? 'bg-white text-gray-900 hover:bg-gray-100'
                  : 'bg-gray-900 text-white hover:bg-black'
            }`}
          >
            {isGeneratingAudio ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Headphones size={18} />
            )}
            <span>{isGeneratingAudio ? 'Loading...' : 'Listen'}</span>
          </button>

          {/* Settings Toggle */}
          <div className="relative">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2 rounded-full transition-colors ${activeUI.hover} ${showSettings ? 'opacity-100' : 'opacity-60'}`}
            >
              <Type size={20} />
            </button>

            {/* Settings Popover */}
            {showSettings && (
              <div
                className={`absolute right-0 top-12 w-72 rounded-2xl shadow-2xl p-4 border ${activeUI.border} ${activeUI.popover} animate-in zoom-in-95 duration-200 z-50`}
              >
                {/* Theme Selector */}
                <div className="mb-6">
                  <span
                    className={`text-[10px] font-black uppercase tracking-widest block mb-3 opacity-50`}
                  >
                    Theme
                  </span>
                  <div className="flex gap-2 bg-black/5 p-1 rounded-xl">
                    {(['light', 'sepia', 'dark'] as Theme[]).map((t) => (
                      <button
                        key={t}
                        onClick={() => setTheme(t)}
                        className={`flex-1 py-2 rounded-lg flex items-center justify-center transition-all ${theme === t ? 'shadow-sm ring-1 ring-black/5' : 'hover:bg-white/50'}`}
                        style={{
                          backgroundColor:
                            t === 'light' ? '#ffffff' : t === 'sepia' ? '#F4ECD8' : '#333333',
                          color: t === 'dark' ? '#fff' : '#000',
                        }}
                      >
                        {t === 'light' ? (
                          <Sun size={16} />
                        ) : t === 'sepia' ? (
                          <BookIcon size={16} />
                        ) : (
                          <Moon size={16} />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Font Size Selector */}
                <div>
                  <span
                    className={`text-[10px] font-black uppercase tracking-widest block mb-3 opacity-50`}
                  >
                    Text Size
                  </span>
                  <div
                    className={`flex items-center justify-between px-4 py-3 rounded-xl border ${activeUI.border}`}
                  >
                    <button
                      onClick={() => setFontSize('text-base')}
                      className={`hover:opacity-100 transition-opacity ${fontSize === 'text-base' ? 'opacity-100' : 'opacity-40'}`}
                    >
                      <span className="text-sm font-serif">Aa</span>
                    </button>
                    <button
                      onClick={() => setFontSize('text-lg')}
                      className={`hover:opacity-100 transition-opacity ${fontSize === 'text-lg' ? 'opacity-100' : 'opacity-40'}`}
                    >
                      <span className="text-lg font-serif">Aa</span>
                    </button>
                    <button
                      onClick={() => setFontSize('text-xl')}
                      className={`hover:opacity-100 transition-opacity ${fontSize === 'text-xl' ? 'opacity-100' : 'opacity-40'}`}
                    >
                      <span className="text-xl font-serif">Aa</span>
                    </button>
                    <button
                      onClick={() => setFontSize('text-2xl')}
                      className={`hover:opacity-100 transition-opacity ${fontSize === 'text-2xl' ? 'opacity-100' : 'opacity-40'}`}
                    >
                      <span className="text-2xl font-serif">Aa</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* --- Main Reading Area --- */}
      <main
        ref={contentRef}
        className="flex-grow overflow-y-auto scroll-smooth relative"
        onClick={() => setShowSettings(false)}
      >
        <div
          className={`max-w-2xl mx-auto px-6 py-12 md:py-20 ${fontSize} transition-all duration-300`}
        >
          <div key={page} className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <RenderFormattedContent content={pages[page]} isFirstPage={page === 0} theme={theme} />
          </div>

          {/* Chapter End Navigation (In-Flow) */}
          <div className="mt-20 pt-10 border-t border-dashed border-current opacity-20" />

          <div className="flex flex-col gap-4 mt-10 mb-20">
            {page < pages.length - 1 ? (
              <button
                onClick={nextPage}
                className={`w-full py-8 rounded-2xl border-2 border-dashed ${activeUI.border} ${activeUI.hover} transition-all group flex flex-col items-center justify-center gap-2`}
              >
                <span className="text-xs font-bold uppercase tracking-widest opacity-50">
                  Continue Reading
                </span>
                <span className="font-serif font-bold text-xl flex items-center gap-2">
                  Next Chapter{' '}
                  <ChevronRight
                    size={20}
                    className="group-hover:translate-x-1 transition-transform"
                  />
                </span>
              </button>
            ) : (
              <div className="text-center py-10 opacity-60">
                <BookIcon size={40} className="mx-auto mb-4 opacity-50" strokeWidth={1} />
                <p className="font-serif italic">You have reached the end of this summary.</p>
                <button
                  onClick={onClose}
                  className="mt-4 text-xs font-bold uppercase tracking-widest underline decoration-2 decoration-orange-500 underline-offset-4 hover:text-orange-500 transition-colors"
                >
                  Close Reader
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* --- Footer / Progress --- */}
      <footer
        className={`h-14 border-t ${activeUI.border} backdrop-blur-md flex items-center justify-between px-6 md:px-12 z-20`}
      >
        <div className="w-24">
          <button
            onClick={prevPage}
            disabled={page === 0}
            className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-0 ${activeUI.hover} py-2 px-3 rounded-lg`}
          >
            <ChevronLeft size={14} /> Back
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center gap-2 max-w-xs mx-auto">
          <div
            className={`w-full h-1 rounded-full opacity-20 ${theme === 'dark' ? 'bg-white' : 'bg-black'}`}
          >
            <div
              className={`h-full rounded-full transition-all duration-500 ${theme === 'dark' ? 'bg-orange-500' : 'bg-orange-600'}`}
              style={{ width: `${((page + 1) / pages.length) * 100}%` }}
            />
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest opacity-40">
            {Math.round(((page + 1) / pages.length) * 100)}% Complete
          </span>
        </div>

        <div className="w-24 flex justify-end">
          <button
            onClick={nextPage}
            disabled={page === pages.length - 1}
            className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-0 ${activeUI.hover} py-2 px-3 rounded-lg`}
          >
            Next <ChevronRight size={14} />
          </button>
        </div>
      </footer>
    </div>
  );
};
