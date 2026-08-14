import React, { useState, useEffect } from 'react';
import type { Book, Priority, BookStatus, Summary, VoiceName } from '../types';
import {
  ArrowLeft,
  List,
  Zap,
  BookOpen,
  Download,
  Trash2,
  Sparkles,
  FileText,
  Headphones,
  ExternalLink,
  Star,
  CheckCircle,
  RotateCcw,
  PlusCircle,
  MessageSquare,
  PenTool,
  BrainCircuit,
} from 'lucide-react';
import { getOrCreateNarration, clearNarration } from '../lib/ai/narration';
import { generateDetailedSummary } from '../lib/ai/summarize';
import { blobs } from '../lib/storage/repo';
import { toast } from './ui/toastStore';
import { toAiError } from '../lib/ai/errors';
import { bookToMarkdown } from '../lib/markdown';
import { downloadText, slugify } from '../lib/download';
import type { AudioTrack } from './AudioPlayer';
import { ChatModal } from './ChatModal';
import { QuizModal } from './QuizModal';

// Helper for inline formatting (bold/italic)
const formatInline = (text: string) => {
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-bold text-gray-900 dark:text-gray-100">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return (
        <em key={i} className="italic text-gray-800">
          {part.slice(1, -1)}
        </em>
      );
    }
    return part;
  });
};

// Component to render Markdown-styled summaries (headers, paragraphs, lists)
const SummaryRenderer: React.FC<{ text: string }> = ({ text }) => {
  if (!text) return null;

  // CRITICAL FIX: Replace literal "\n" string characters with actual newlines
  const cleanText = text.replace(/\\n/g, '\n').replace(/\r\n/g, '\n');
  const blocks = cleanText.split(/\n\n+/);

  return (
    <div className="space-y-4 text-gray-800 leading-relaxed text-lg">
      {blocks.map((block, idx) => {
        const trimmed = block.trim();
        if (!trimmed) return null;

        const headerMatch = trimmed.match(/^(#{1,6})\s+(.*)/);
        if (headerMatch) {
          const level = headerMatch[1].length;
          const content = headerMatch[2];
          if (level === 1 || level === 2) {
            return (
              <h3
                key={idx}
                className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-8 mb-3"
              >
                {formatInline(content)}
              </h3>
            );
          }
          return (
            <h4 key={idx} className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-6 mb-2">
              {formatInline(content)}
            </h4>
          );
        }

        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          const items = trimmed.split('\n');
          return (
            <ul key={idx} className="space-y-3 pl-2 my-4">
              {items.map((item, i) => {
                const cleanItem = item.replace(/^[-*]\s+/, '');
                return (
                  <li key={i} className="flex gap-3 items-start">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-2.5 flex-shrink-0" />
                    <span className="flex-1">{formatInline(cleanItem)}</span>
                  </li>
                );
              })}
            </ul>
          );
        }

        return (
          <p key={idx} className="mb-2">
            {formatInline(trimmed)}
          </p>
        );
      })}
    </div>
  );
};

interface BookDetailProps {
  book: Book;
  summary: Summary | undefined;
  voice: VoiceName;
  onSummaryUpdate: (summary: Summary) => void;
  onBack: () => void;
  onDelete: (id: string) => void;
  onUpdate: (updatedBook: Book) => void;
  onOpenReader: (book: Book) => void;
  isPreview?: boolean;
  onAdd?: () => void;
  onPlayAudio: (track: AudioTrack) => void;
  /** Generates and saves a summary for a book that has none. */
  onSummarise: () => Promise<void>;
  /** Surfaces an AI failure and opens the key dialog when the key is the problem. */
  onAiError: (error: unknown) => string;
}

export const BookDetail: React.FC<BookDetailProps> = ({
  book,
  summary,
  voice,
  onSummaryUpdate,
  onBack,
  onDelete,
  onUpdate,
  onOpenReader,
  isPreview,
  onAdd,
  onPlayAudio,
  onSummarise,
  onAiError,
}) => {
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [isGeneratingDeepDive, setIsGeneratingDeepDive] = useState(false);
  const [isSummarising, setIsSummarising] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [notes, setNotes] = useState(book.personalNotes || '');

  /**
   * Without this there was no route from an unsummarised book to a summarised
   * one, so every Goodreads import — the whole point of which is that it makes
   * no AI call — was a permanent dead end, and chat, quiz, audio, deep dive and
   * the review deck were all unreachable for it.
   */
  const handleSummarise = async () => {
    setIsSummarising(true);
    try {
      await onSummarise();
      // The narration script is built from the summary, so any cached audio for
      // this book is now describing text that no longer exists.
      await clearNarration(book.id);
    } catch (error) {
      toast.error(onAiError(error));
    } finally {
      setIsSummarising(false);
    }
  };

  // Sync notes local state if book prop changes (e.g. initial load)
  useEffect(() => {
    setNotes(book.personalNotes || '');
  }, [book.personalNotes]);

  const handlePlayAudio = async (type: 'short' | 'long') => {
    if (!summary) return;
    setIsGeneratingAudio(true);
    try {
      // Cached after the first generation: this used to re-bill a TTS call on
      // every single play of the same summary.
      const wavBlob = await getOrCreateNarration(book, summary, type, voice);

      onPlayAudio({
        src: URL.createObjectURL(wavBlob),
        title: book.title,
        author: book.author,
        coverUrl: book.coverImageUrl,
      });
    } catch (error) {
      toast.error(onAiError(error));
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const handleMasterclassClick = async () => {
    if (summary?.detailedSummary) {
      onOpenReader(book);
      return;
    }

    setIsGeneratingDeepDive(true);
    try {
      if (!summary) return;
      const longSummary = await generateDetailedSummary(book, summary);
      const updated = { ...summary, detailedSummary: longSummary };
      onSummaryUpdate(updated);
      onOpenReader(book);
    } catch (error) {
      toast.error(toAiError(error).message);
    } finally {
      setIsGeneratingDeepDive(false);
    }
  };

  const handleOpenPdf = async () => {
    if (!book.hasPdf) return;
    const pdf = await blobs.get(book.id, 'pdf');
    if (!pdf) {
      toast.error('That PDF is no longer stored on this device.');
      return;
    }

    const url = URL.createObjectURL(pdf);
    window.open(url, '_blank');
    // The new tab has read the URL by the time it is open; revoking in the same
    // task can cancel the load, so this defers by a tick. Without it every click
    // pinned the whole PDF in memory until the page was reloaded.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const updateRating = (newRating: number) => {
    onUpdate({ ...book, rating: newRating });
  };

  const updatePriority = (newPriority: Priority) => {
    onUpdate({ ...book, priority: newPriority });
  };

  const toggleStatus = (newStatus: BookStatus) => {
    onUpdate({
      ...book,
      status: newStatus,
      rating: newStatus === 'Finished' ? book.rating || 5 : book.rating,
      // Nothing in the app used to write finishedAt, which is why the "Monthly
      // Goal" ring counted the whole library and stuck at 100%. An existing date
      // is kept, so re-marking a book does not move it into the current month.
      finishedAt:
        newStatus === 'Finished' ? (book.finishedAt ?? new Date().toISOString()) : undefined,
    });
  };

  const handleSaveNotes = () => {
    if (notes !== book.personalNotes) {
      onUpdate({ ...book, personalNotes: notes });
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      <button
        onClick={onBack}
        className="mb-8 flex items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-orange-700 dark:hover:text-orange-400 transition-colors group"
      >
        <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
        {isPreview ? 'Discard Preview' : 'Back to Library'}
      </button>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
        {/* Sidebar info */}
        <div className="md:col-span-4">
          <div className="sticky top-8">
            <div className="relative mb-6">
              <img
                src={book.coverImageUrl}
                alt={book.title}
                className="w-full rounded-2xl shadow-2xl"
              />
              {isPreview && (
                <div className="absolute -top-3 -right-3 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg border-2 border-white">
                  PREVIEW
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-6">
              {isPreview && onAdd ? (
                <div className="pb-4 border-b border-gray-100 dark:border-gray-800">
                  <button
                    onClick={onAdd}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-orange-200 animate-pulse active:scale-95"
                  >
                    <PlusCircle size={20} />
                    Add to Library
                  </button>
                  <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-2 font-medium">
                    Save to keep your progress
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {book.status === 'Finished' && (
                    <div>
                      <span className="text-xs font-bold uppercase tracking-widest text-orange-700 dark:text-orange-400 mb-2 block">
                        My Rating
                      </span>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((num) => (
                          <button
                            key={num}
                            onClick={() => updateRating(num)}
                            className={`transition-all ${num <= Math.round(book.rating) ? 'text-amber-400' : 'text-gray-200'} hover:scale-125`}
                          >
                            <Star
                              size={24}
                              fill={num <= Math.round(book.rating) ? 'currentColor' : 'none'}
                            />
                          </button>
                        ))}
                        <span className="ml-2 font-bold text-gray-900 dark:text-gray-100">
                          {book.rating}
                        </span>
                      </div>
                    </div>
                  )}

                  {book.status === 'Want to Read' && (
                    <div>
                      <span className="text-xs font-bold uppercase tracking-widest text-orange-700 dark:text-orange-400 mb-2 block">
                        Priority
                      </span>
                      <div className="flex gap-2">
                        {(['Low', 'Medium', 'High'] as Priority[]).map((p) => (
                          <button
                            key={p}
                            onClick={() => updatePriority(p)}
                            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all border ${
                              book.priority === p
                                ? 'bg-orange-600 text-white border-orange-600'
                                : 'bg-white dark:bg-gray-900 text-gray-400 dark:text-gray-500 border-gray-100 dark:border-gray-800 hover:border-orange-200'
                            }`}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 py-4 border-y border-gray-50">
                <div>
                  <span className="text-xs font-bold uppercase tracking-widest text-orange-700 dark:text-orange-400 mb-1 block">
                    Category
                  </span>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{book.category}</p>
                </div>
                <div>
                  <span className="text-xs font-bold uppercase tracking-widest text-orange-700 dark:text-orange-400 mb-1 block">
                    Length
                  </span>
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    {book.readingTimeMinutes} mins
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                {/* Both prompts read the summary, so neither is offered without one.
                    A book can legitimately have no summary — that is what keeps
                    Goodreads import free. */}
                {!isPreview && summary && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setShowChat(true)}
                      className="w-full flex items-center justify-center gap-2 py-3 px-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all active:scale-95 text-xs lg:text-sm shadow-lg shadow-indigo-100"
                    >
                      <MessageSquare size={16} />
                      Chat
                    </button>
                    <button
                      onClick={() => setShowQuiz(true)}
                      className="w-full flex items-center justify-center gap-2 py-3 px-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold transition-all active:scale-95 text-xs lg:text-sm shadow-lg shadow-rose-100"
                    >
                      <BrainCircuit size={16} />
                      Quiz
                    </button>
                  </div>
                )}

                {book.status === 'Want to Read' ? (
                  <button
                    onClick={() => toggleStatus('Finished')}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-all active:scale-95 text-sm shadow-lg shadow-emerald-100"
                  >
                    <CheckCircle size={16} />
                    Mark as Finished
                  </button>
                ) : (
                  <button
                    onClick={() => toggleStatus('Want to Read')}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-xl font-bold transition-all active:scale-95 text-sm"
                  >
                    <RotateCcw size={16} />
                    Move back to Queue
                  </button>
                )}

                <div className="h-px bg-gray-100 dark:bg-gray-800 my-2" />

                {/* Audio and the deep dive both read the summary. They used to
                    render regardless, set their spinner, then hit an early
                    `if (!summary) return` — so they flashed and did nothing. */}
                {!isPreview && !summary && (
                  <button
                    onClick={() => void handleSummarise()}
                    disabled={isSummarising}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold transition-all disabled:opacity-50 text-sm shadow-lg shadow-orange-100 active:scale-95"
                  >
                    {isSummarising ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Sparkles size={16} />
                    )}
                    {isSummarising ? 'Summarising…' : 'Summarise this book'}
                  </button>
                )}

                {summary && (
                  <>
                    <button
                      onClick={() => handlePlayAudio('short')}
                      disabled={isGeneratingAudio}
                      className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-semibold transition-colors disabled:opacity-50 text-sm"
                    >
                      {isGeneratingAudio ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Headphones size={16} />
                      )}
                      {isGeneratingAudio ? 'Generating Audio...' : 'Quick Listen'}
                    </button>

                    <button
                      onClick={handleMasterclassClick}
                      disabled={isGeneratingDeepDive}
                      className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-stone-900 hover:bg-black text-white rounded-xl font-semibold transition-all disabled:opacity-50 text-sm shadow-lg shadow-stone-100 active:scale-95"
                    >
                      {isGeneratingDeepDive ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Sparkles size={16} />
                      )}
                      {isGeneratingDeepDive ? 'Synthesizing...' : 'Read Full Summary'}
                    </button>
                  </>
                )}

                {book.hasPdf && (
                  <button
                    onClick={() => void handleOpenPdf()}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition-all text-sm active:scale-95"
                  >
                    <FileText size={16} className="text-rose-500" />
                    Open Original PDF
                    <ExternalLink size={14} className="opacity-40" />
                  </button>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => {
                    downloadText(`${slugify(book.title)}.md`, bookToMarkdown(book, summary));
                    toast.success('Markdown downloaded.');
                  }}
                  className="flex-1 flex items-center justify-center gap-2 py-2 px-3 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-sm"
                >
                  <Download size={16} /> Export Markdown
                </button>
                {!isPreview && (
                  <button
                    onClick={() => onDelete(book.id)}
                    className="p-2 border border-red-100 text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="md:col-span-8 space-y-12">
          <header>
            <h1 className="text-4xl md:text-5xl font-serif text-gray-900 dark:text-gray-100 mb-4 leading-tight">
              {book.title}
            </h1>
            <p className="text-xl text-gray-500 dark:text-gray-400 font-medium">By {book.author}</p>
          </header>

          {summary && (
            <section className="bg-orange-50 dark:bg-orange-950/50 p-8 rounded-2xl border border-orange-100 dark:border-orange-900 relative overflow-hidden">
              <Zap
                className="absolute top-4 right-4 text-orange-200 dark:text-orange-800"
                size={40}
              />
              <h2 className="text-lg font-bold text-orange-800 dark:text-orange-300 mb-2 flex items-center gap-2">
                The One Sentence Takeaway
              </h2>
              <p className="text-xl font-serif text-orange-900 dark:text-orange-100 italic leading-relaxed">
                &ldquo;{summary.oneSentenceTakeaway}&rdquo;
              </p>
            </section>
          )}

          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6 flex items-center gap-3">
              <BookOpen size={24} className="text-orange-700 dark:text-orange-400" />
              Summary
            </h2>
            {summary ? (
              <SummaryRenderer text={summary.summary} />
            ) : (
              <div className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-10 text-center">
                <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto mb-6 leading-relaxed">
                  This book has no summary yet. Generating one also unlocks chat, the quiz, audio
                  narration and the review deck for it.
                </p>
                {!isPreview && (
                  <button
                    onClick={() => void handleSummarise()}
                    disabled={isSummarising}
                    className="inline-flex items-center justify-center gap-2 py-3 px-6 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold transition-all disabled:opacity-50 shadow-lg shadow-orange-100 active:scale-95"
                  >
                    {isSummarising ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Sparkles size={16} />
                    )}
                    {isSummarising ? 'Summarising…' : 'Summarise this book'}
                  </button>
                )}
              </div>
            )}
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6 flex items-center gap-3">
              <List size={24} className="text-orange-700 dark:text-orange-400" />
              Key Insights
            </h2>
            <ul className="space-y-4">
              {(summary?.keyInsights ?? []).map((insight, idx) => (
                <li
                  key={idx}
                  className="flex gap-4 items-start bg-white dark:bg-gray-900 p-5 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm"
                >
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-400 flex items-center justify-center font-bold text-sm">
                    {idx + 1}
                  </span>
                  <p className="text-gray-800 leading-relaxed">{insight}</p>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6 flex items-center gap-3">
              <Zap size={24} className="text-amber-500" />
              Actionable Steps
            </h2>
            <div className="space-y-3">
              {(summary?.actionableSteps ?? []).map((step, idx) => (
                <div
                  key={idx}
                  className="flex gap-4 items-center p-4 rounded-xl bg-amber-50/30 border border-amber-100"
                >
                  <div className="w-2 h-2 rounded-full bg-amber-400" />
                  <p className="text-gray-800 font-medium">{step}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Personal Notes Section (New) */}
          <section className="pt-8 border-t border-gray-100 dark:border-gray-800">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6 flex items-center gap-3">
              <PenTool size={24} className="text-indigo-500" />
              My Personal Notes
            </h2>
            <div className="relative">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={handleSaveNotes}
                placeholder="Write down your thoughts, ideas for application, or things you want to remember..."
                className="w-full h-48 p-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-y text-lg leading-relaxed text-gray-800 placeholder:text-gray-400 dark:placeholder:text-gray-500"
              />
              <div className="absolute bottom-4 right-4 text-xs font-medium text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-900/80 px-2 py-1 rounded-md backdrop-blur">
                Auto-saves when you click away
              </div>
            </div>
          </section>

          {isGeneratingDeepDive && (
            <div className="bg-stone-50 rounded-2xl p-12 text-center space-y-4 border-2 border-dashed border-stone-200 animate-pulse">
              <div className="w-12 h-12 border-4 border-stone-900 border-t-transparent rounded-full animate-spin mx-auto" />
              <h3 className="text-xl font-bold text-stone-900">Synthesizing Full Summary...</h3>
              <p className="text-stone-500 max-w-md mx-auto">
                Our AI is analyzing the full depth of this book to prepare your e-reader experience.
              </p>
            </div>
          )}
        </div>
      </div>

      {showChat && summary && (
        <ChatModal
          book={book}
          summary={summary}
          onClose={() => setShowChat(false)}
          onAiError={onAiError}
        />
      )}

      {showQuiz && summary && (
        <QuizModal book={book} summary={summary} onClose={() => setShowQuiz(false)} />
      )}
    </div>
  );
};
