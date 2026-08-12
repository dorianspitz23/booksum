import React, { useState, useRef } from 'react';
import {
  Search,
  Loader2,
  X,
  Sparkles,
  BookPlus,
  BookCheck,
  Bookmark,
  FileUp,
  FileText,
  Star,
} from 'lucide-react';
import { summarizeBook, summarizePdf } from '../lib/ai/summarize';
import type { GeneratedBook } from '../lib/ai/summarize';
import type { AddBookOptions, BookDraft } from '../features/library/useLibrary';
import type { BookStatus, Priority } from '../types';

interface AddBookModalProps {
  onClose: () => void;
  onAdd: (draft: BookDraft, options?: AddBookOptions) => Promise<void>;
  /** Returns a user-facing message and routes key problems to the key dialog. */
  onAiError: (error: unknown) => string;
}

export const AddBookModal: React.FC<AddBookModalProps> = ({ onClose, onAdd, onAiError }) => {
  const [mode, setMode] = useState<'search' | 'upload'>('search');
  const [query, setQuery] = useState('');
  const [author, setAuthor] = useState('');
  const [status, setStatus] = useState<BookStatus>('Finished');
  const [priority, setPriority] = useState<Priority>('Medium');
  const [rating, setRating] = useState(4);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      let generated: GeneratedBook;
      let pdf: Blob | undefined;

      if (mode === 'search') {
        if (!query.trim()) return;
        generated = await summarizeBook(query, author);
      } else {
        if (!file) return;
        const base64 = await convertFileToBase64(file);
        generated = await summarizePdf(base64);
        pdf = file;
      }

      await onAdd(
        {
          ...generated.book,
          oneSentenceTakeaway: generated.summary.oneSentenceTakeaway,
          status,
          rating,
          priority: status === 'Want to Read' ? priority : undefined,
          hasPdf: Boolean(pdf),
        },
        { summary: generated.summary, pdf },
      );
      onClose();
    } catch (err) {
      console.error(err);
      setError(onAiError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected && selected.type === 'application/pdf') {
      setFile(selected);
      setError(null);
    } else {
      setError('Please select a valid PDF file.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6 sm:p-8 overflow-y-auto max-h-[90vh]">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <BookPlus className="text-orange-600" />
              Add New Insight
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex gap-4 mb-8 p-1 bg-gray-100 rounded-2xl">
            <button
              onClick={() => setMode('search')}
              className={`flex-1 py-2 px-4 rounded-xl text-sm font-bold transition-all ${mode === 'search' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-400'}`}
            >
              Search Book
            </button>
            <button
              onClick={() => setMode('upload')}
              className={`flex-1 py-2 px-4 rounded-xl text-sm font-bold transition-all ${mode === 'upload' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-400'}`}
            >
              Upload PDF
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Reading Status
              </label>
              <div className="flex gap-2 p-1 bg-gray-100 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setStatus('Finished')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold transition-all ${status === 'Finished' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-400'}`}
                >
                  <BookCheck size={18} /> Finished
                </button>
                <button
                  type="button"
                  onClick={() => setStatus('Want to Read')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold transition-all ${status === 'Want to Read' ? 'bg-white text-amber-600 shadow-sm' : 'text-gray-400'}`}
                >
                  <Bookmark size={18} /> Want to Read
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {status === 'Finished' ? (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    My Rating (1-5)
                  </label>
                  <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl">
                    <Star size={16} className="text-amber-400 fill-amber-400" />
                    <input
                      type="number"
                      min="1"
                      max="5"
                      step="1"
                      value={rating}
                      onChange={(e) => setRating(Number(e.target.value))}
                      className="bg-transparent outline-none w-full font-bold text-gray-900"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as Priority)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-bold text-gray-700"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
              )}
            </div>

            {mode === 'search' ? (
              <>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Book Title *
                  </label>
                  <div className="relative">
                    <Search
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                      size={18}
                    />
                    <input
                      type="text"
                      required={mode === 'search'}
                      placeholder="e.g. Sapiens, Atomic Habits..."
                      className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-orange-500 focus:bg-white outline-none transition-all text-gray-900"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Author (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Yuval Noah Harari"
                    className="w-full px-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-orange-500 focus:bg-white outline-none transition-all text-gray-900"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                  />
                </div>
              </>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-3xl p-10 flex flex-col items-center justify-center cursor-pointer transition-all ${
                  file
                    ? 'border-orange-500 bg-orange-50'
                    : 'border-gray-200 hover:border-orange-400 hover:bg-gray-50'
                }`}
              >
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                />
                {file ? (
                  <>
                    <FileText size={48} className="text-orange-600 mb-4" />
                    <p className="font-bold text-orange-900">{file.name}</p>
                    <p className="text-xs text-orange-600">Click to change file</p>
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                      <FileUp size={32} className="text-gray-400" />
                    </div>
                    <p className="font-bold text-gray-900">Choose a PDF file</p>
                    <p className="text-sm text-gray-500">Maximum size: 10MB</p>
                  </>
                )}
              </div>
            )}

            {error && (
              <div className="p-4 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={
                isLoading || (mode === 'search' && !query.trim()) || (mode === 'upload' && !file)
              }
              className="w-full py-4 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white rounded-2xl font-bold text-lg shadow-lg shadow-orange-200 transition-all flex items-center justify-center gap-2 group"
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  {mode === 'upload' ? 'Reading PDF...' : 'Analyzing with AI...'}
                </>
              ) : (
                <>
                  <Sparkles size={20} className="group-hover:rotate-12 transition-transform" />
                  Generate Insights
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
