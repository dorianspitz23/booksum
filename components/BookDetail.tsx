
import React, { useState, useEffect } from 'react';
import { BookInsight, Priority, BookStatus } from '../types';
import { ArrowLeft, Play, Pause, List, Zap, BookOpen, Share2, Trash2, Sparkles, FileText, Headphones, ExternalLink, Star, CheckCircle, RotateCcw, PlusCircle, MessageSquare, PenTool, BrainCircuit } from 'lucide-react';
import { generateAudioSummary, generateDetailedSummary, base64PCMToWavBlob } from '../services/geminiService';
import { AudioTrack } from './AudioPlayer';
import { ChatModal } from './ChatModal';
import { QuizModal } from './QuizModal';

// Helper for inline formatting (bold/italic)
const formatInline = (text: string) => {
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-bold text-gray-900">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={i} className="italic text-gray-800">{part.slice(1, -1)}</em>;
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
             return <h3 key={idx} className="text-xl font-bold text-gray-900 mt-8 mb-3">{formatInline(content)}</h3>;
          }
          return <h4 key={idx} className="text-lg font-bold text-gray-900 mt-6 mb-2">{formatInline(content)}</h4>;
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

        return <p key={idx} className="mb-2">{formatInline(trimmed)}</p>;
      })}
    </div>
  );
};

interface BookDetailProps {
  book: BookInsight;
  onBack: () => void;
  onDelete: (id: string) => void;
  onUpdate: (updatedBook: BookInsight) => void;
  onOpenReader: (book: BookInsight) => void;
  isPreview?: boolean;
  onAdd?: () => void;
  onPlayAudio: (track: AudioTrack) => void;
}

export const BookDetail: React.FC<BookDetailProps> = ({ book, onBack, onDelete, onUpdate, onOpenReader, isPreview, onAdd, onPlayAudio }) => {
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [isGeneratingDeepDive, setIsGeneratingDeepDive] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [notes, setNotes] = useState(book.personalNotes || '');

  // Sync notes local state if book prop changes (e.g. initial load)
  useEffect(() => {
    setNotes(book.personalNotes || '');
  }, [book.personalNotes]);

  const handlePlayAudio = async (type: 'short' | 'long') => {
    try {
      setIsGeneratingAudio(true);
      const base64 = await generateAudioSummary(book, type);
      const wavBlob = base64PCMToWavBlob(base64);
      const audioUrl = URL.createObjectURL(wavBlob);
      
      onPlayAudio({
        src: audioUrl,
        title: book.title,
        author: book.author,
        coverUrl: book.coverImageUrl
      });
    } catch (error) {
      console.error("Audio error:", error);
      alert("Failed to generate audio summary.");
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const handleMasterclassClick = async () => {
    if (book.detailedSummary) {
      onOpenReader(book);
      return;
    }

    setIsGeneratingDeepDive(true);
    try {
      const longSummary = await generateDetailedSummary(book);
      const updatedBook = { ...book, detailedSummary: longSummary };
      onUpdate(updatedBook);
      onOpenReader(updatedBook);
    } catch (error) {
      console.error("Deep dive error:", error);
      alert("Failed to generate summary. Please try again.");
    } finally {
      setIsGeneratingDeepDive(false);
    }
  };

  const handleOpenPdf = () => {
    if (!book.pdfData) return;
    const byteCharacters = atob(book.pdfData);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
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
      rating: newStatus === 'Finished' ? (book.rating || 5) : book.rating 
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
        className="mb-8 flex items-center gap-2 text-gray-500 hover:text-orange-600 transition-colors group"
      >
        <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
        {isPreview ? "Discard Preview" : "Back to Library"}
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

            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-6">
              {isPreview && onAdd ? (
                 <div className="pb-4 border-b border-gray-100">
                   <button 
                     onClick={onAdd}
                     className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-orange-200 animate-pulse active:scale-95"
                   >
                     <PlusCircle size={20} />
                     Add to Library
                   </button>
                   <p className="text-xs text-gray-400 text-center mt-2 font-medium">Save to keep your progress</p>
                 </div>
              ) : (
                <div className="space-y-4">
                  {book.status === 'Finished' && (
                    <div>
                      <span className="text-xs font-bold uppercase tracking-widest text-orange-600 mb-2 block">My Rating</span>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((num) => (
                          <button 
                            key={num}
                            onClick={() => updateRating(num)}
                            className={`transition-all ${num <= Math.round(book.rating) ? 'text-amber-400' : 'text-gray-200'} hover:scale-125`}
                          >
                            <Star size={24} fill={num <= Math.round(book.rating) ? "currentColor" : "none"} />
                          </button>
                        ))}
                        <span className="ml-2 font-bold text-gray-900">{book.rating}</span>
                      </div>
                    </div>
                  )}

                  {book.status === 'Want to Read' && (
                    <div>
                      <span className="text-xs font-bold uppercase tracking-widest text-orange-600 mb-2 block">Priority</span>
                      <div className="flex gap-2">
                        {(['Low', 'Medium', 'High'] as Priority[]).map((p) => (
                          <button
                            key={p}
                            onClick={() => updatePriority(p)}
                            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all border ${
                              book.priority === p 
                                ? 'bg-orange-600 text-white border-orange-600' 
                                : 'bg-white text-gray-400 border-gray-100 hover:border-orange-200'
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
                  <span className="text-xs font-bold uppercase tracking-widest text-orange-600 mb-1 block">Category</span>
                  <p className="font-medium text-gray-900">{book.category}</p>
                </div>
                <div>
                  <span className="text-xs font-bold uppercase tracking-widest text-orange-600 mb-1 block">Length</span>
                  <p className="font-medium text-gray-900">{book.readingTimeMinutes} mins</p>
                </div>
              </div>

              <div className="space-y-2">
                 {/* Chat with Book Button (New) */}
                 {!isPreview && (
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

                <div className="h-px bg-gray-100 my-2" />

                <button 
                  onClick={() => handlePlayAudio('short')}
                  disabled={isGeneratingAudio}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-semibold transition-colors disabled:opacity-50 text-sm"
                >
                  {isGeneratingAudio ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : <Headphones size={16} />}
                  {isGeneratingAudio ? "Generating Audio..." : "Quick Listen"}
                </button>

                <button 
                  onClick={handleMasterclassClick}
                  disabled={isGeneratingDeepDive}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-stone-900 hover:bg-black text-white rounded-xl font-semibold transition-all disabled:opacity-50 text-sm shadow-lg shadow-stone-100 active:scale-95"
                >
                  {isGeneratingDeepDive ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : <Sparkles size={16} />}
                  {isGeneratingDeepDive ? "Synthesizing..." : "Read Full Summary"}
                </button>

                {book.pdfData && (
                  <button 
                    onClick={handleOpenPdf}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-white border border-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-all text-sm active:scale-95"
                  >
                    <FileText size={16} className="text-rose-500" />
                    Open Original PDF
                    <ExternalLink size={14} className="opacity-40" />
                  </button>
                )}
              </div>
              
              <div className="flex gap-2 pt-2">
                <button className="flex-1 flex items-center justify-center gap-2 py-2 px-3 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors text-sm">
                  <Share2 size={16} /> Share
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
            <h1 className="text-4xl md:text-5xl font-serif text-gray-900 mb-4 leading-tight">{book.title}</h1>
            <p className="text-xl text-gray-500 font-medium">By {book.author}</p>
          </header>

          <section className="bg-orange-50/50 p-8 rounded-2xl border border-orange-100 relative overflow-hidden">
            <Zap className="absolute top-4 right-4 text-orange-200" size={40} />
            <h2 className="text-lg font-bold text-orange-800 mb-2 flex items-center gap-2">
              The One Sentence Takeaway
            </h2>
            <p className="text-xl font-serif text-orange-900 italic leading-relaxed">
              "{book.oneSentenceTakeaway}"
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
              <BookOpen size={24} className="text-orange-600" />
              Summary
            </h2>
            <SummaryRenderer text={book.summary} />
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
              <List size={24} className="text-orange-600" />
              Key Insights
            </h2>
            <ul className="space-y-4">
              {book.keyInsights.map((insight, idx) => (
                <li key={idx} className="flex gap-4 items-start bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center font-bold text-sm">
                    {idx + 1}
                  </span>
                  <p className="text-gray-800 leading-relaxed">{insight}</p>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
              <Zap size={24} className="text-amber-500" />
              Actionable Steps
            </h2>
            <div className="space-y-3">
              {book.actionableSteps.map((step, idx) => (
                <div key={idx} className="flex gap-4 items-center p-4 rounded-xl bg-amber-50/30 border border-amber-100">
                  <div className="w-2 h-2 rounded-full bg-amber-400" />
                  <p className="text-gray-800 font-medium">{step}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Personal Notes Section (New) */}
          <section className="pt-8 border-t border-gray-100">
             <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
               <PenTool size={24} className="text-indigo-500" />
               My Personal Notes
             </h2>
             <div className="relative">
               <textarea 
                 value={notes}
                 onChange={(e) => setNotes(e.target.value)}
                 onBlur={handleSaveNotes}
                 placeholder="Write down your thoughts, ideas for application, or things you want to remember..."
                 className="w-full h-48 p-6 bg-white border border-gray-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-y text-lg leading-relaxed text-gray-800 placeholder:text-gray-400"
               />
               <div className="absolute bottom-4 right-4 text-xs font-medium text-gray-400 bg-white/80 px-2 py-1 rounded-md backdrop-blur">
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

      {showChat && (
        <ChatModal 
          book={book} 
          onClose={() => setShowChat(false)} 
        />
      )}
      
      {showQuiz && (
        <QuizModal 
          book={book} 
          onClose={() => setShowQuiz(false)} 
        />
      )}
    </div>
  );
};
