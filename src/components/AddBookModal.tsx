import React, { useState, useRef } from 'react';
import {
  Search,
  Loader2,
  Sparkles,
  BookCheck,
  Bookmark,
  FileUp,
  FileText,
  Star,
} from 'lucide-react';
import { MAX_PDF_BYTES, summarizeBook, summarizePdf } from '../lib/ai/summarize';
import { fetchCover } from '../lib/covers';
import type { GeneratedBook } from '../lib/ai/summarize';
import type { AddBookOptions, BookDraft } from '../features/library/useLibrary';
import { Dialog } from './ui/Dialog';
import { GoodreadsImport } from '../features/library/GoodreadsImport';
import type { BookStatus, Priority } from '../types';

interface AddBookModalProps {
  onClose: () => void;
  onAdd: (draft: BookDraft, options?: AddBookOptions) => Promise<void>;
  /** Returns a user-facing message and routes key problems to the key dialog. */
  onAiError: (error: unknown) => string;
}

export const AddBookModal: React.FC<AddBookModalProps> = ({ onClose, onAdd, onAiError }) => {
  const [mode, setMode] = useState<'search' | 'upload' | 'goodreads'>('search');
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
          // Adding a book straight to Finished is a completion event too.
          finishedAt: status === 'Finished' ? new Date().toISOString() : undefined,
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

  /**
   * Adds the book with no AI call at all.
   *
   * The README says the library works without a key, and it did not: every add
   * path except the Goodreads CSV tab went through `summarizeBook` or
   * `summarizePdf`, so a keyless user could import three hundred books at once
   * and not add one. The data model already supports an unsummarised book — that
   * is exactly what an import produces — there was just no way to make one by
   * hand, and the "Summarise this book" button on the detail page was
   * unreachable for anything you typed yourself.
   *
   * The cover comes from the free Google Books / OpenLibrary chain, which needs
   * no key. Bulk import deliberately does not use it: one request per book would
   * mean three hundred for a large library, so that path stays ISBN-only.
   */
  const handleAddWithoutAi = async () => {
    if (!query.trim()) return;
    setIsLoading(true);
    setError(null);

    try {
      const title = query.trim();
      const writer = author.trim() || 'Unknown';

      await onAdd({
        title,
        author: writer,
        category: 'Other',
        status,
        rating,
        priority: status === 'Want to Read' ? priority : undefined,
        coverImageUrl: await fetchCover(title, writer),
        readingTimeMinutes: 0,
        hasPdf: false,
        finishedAt: status === 'Finished' ? new Date().toISOString() : undefined,
      });
      onClose();
    } catch (err) {
      console.error(err);
      setError('Could not add that book.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    // Reset the input so picking the same file again after an error still fires
    // a change event, and clear any previously accepted file: rejecting a second
    // pick used to leave the first one selected and silently submittable.
    e.target.value = '';
    setFile(null);

    if (!selected) return;

    const looksLikePdf =
      selected.type === 'application/pdf' || selected.name.toLowerCase().endsWith('.pdf');
    if (!looksLikePdf) {
      setError('Please select a PDF file.');
      return;
    }

    if (selected.size > MAX_PDF_BYTES) {
      const mb = (selected.size / 1024 / 1024).toFixed(1);
      setError(`That PDF is ${mb}MB. The limit is 10MB.`);
      return;
    }

    setFile(selected);
    setError(null);
  };

  return (
    <Dialog open title="Add New Insight" onClose={onClose}>
      <div className="flex gap-4 mb-8 p-1 bg-gray-100 dark:bg-gray-800 rounded-2xl">
        <button
          onClick={() => setMode('search')}
          className={`flex-1 py-2 px-4 rounded-xl text-sm font-bold transition-all ${mode === 'search' ? 'bg-white dark:bg-gray-900 text-orange-700 dark:text-orange-400 shadow-sm' : 'text-gray-400 dark:text-gray-500'}`}
        >
          Search Book
        </button>
        <button
          onClick={() => setMode('upload')}
          className={`flex-1 py-2 px-4 rounded-xl text-sm font-bold transition-all ${mode === 'upload' ? 'bg-white dark:bg-gray-900 text-orange-700 dark:text-orange-400 shadow-sm' : 'text-gray-400 dark:text-gray-500'}`}
        >
          Upload PDF
        </button>
        <button
          onClick={() => setMode('goodreads')}
          className={`flex-1 py-2 px-4 rounded-xl text-sm font-bold transition-all ${mode === 'goodreads' ? 'bg-white dark:bg-gray-900 text-orange-700 dark:text-orange-400 shadow-sm' : 'text-gray-400 dark:text-gray-500'}`}
        >
          Goodreads
        </button>
      </div>

      {mode === 'goodreads' ? (
        <GoodreadsImport onDone={onClose} />
      ) : (
        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Reading Status
            </label>
            <div className="flex gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-2xl">
              <button
                type="button"
                onClick={() => setStatus('Finished')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold transition-all ${status === 'Finished' ? 'bg-white dark:bg-gray-900 text-orange-700 dark:text-orange-400 shadow-sm' : 'text-gray-400 dark:text-gray-500'}`}
              >
                <BookCheck size={18} /> Finished
              </button>
              <button
                type="button"
                onClick={() => setStatus('Want to Read')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold transition-all ${status === 'Want to Read' ? 'bg-white dark:bg-gray-900 text-amber-600 shadow-sm' : 'text-gray-400 dark:text-gray-500'}`}
              >
                <Bookmark size={18} /> Want to Read
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {status === 'Finished' ? (
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  My Rating (1-5)
                </label>
                <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-2xl">
                  <Star size={16} className="text-amber-400 fill-amber-400" />
                  <input
                    type="number"
                    min="1"
                    max="5"
                    step="1"
                    value={rating}
                    onChange={(e) => setRating(Number(e.target.value))}
                    className="bg-transparent outline-none w-full font-bold text-gray-900 dark:text-gray-100"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as Priority)}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-2xl outline-none font-bold text-gray-700 dark:text-gray-300"
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
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Book Title *
                </label>
                <div className="relative">
                  <Search
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"
                    size={18}
                  />
                  <input
                    type="text"
                    required={mode === 'search'}
                    placeholder="e.g. Sapiens, Atomic Habits..."
                    className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-2xl focus:ring-2 focus:ring-orange-500 focus:bg-white dark:focus:bg-gray-900 outline-none transition-all text-gray-900 dark:text-gray-100"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Author (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Yuval Noah Harari"
                  className="w-full px-4 py-4 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-2xl focus:ring-2 focus:ring-orange-500 focus:bg-white dark:focus:bg-gray-900 outline-none transition-all text-gray-900 dark:text-gray-100"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                />
              </div>
            </>
          ) : (
            <>
              {/* A button, not a div: this was a bare <div onClick> wrapping a
                  hidden input, so uploading a PDF was impossible with a keyboard.
                  The input is a sibling rather than a child — an <input> inside a
                  <button> is invalid HTML. */}
              <input
                type="file"
                className="hidden"
                accept=".pdf,application/pdf"
                ref={fileInputRef}
                onChange={handleFileChange}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={`w-full border-2 border-dashed rounded-3xl p-10 flex flex-col items-center justify-center cursor-pointer transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 ${
                  file
                    ? 'border-orange-500 bg-orange-50 dark:bg-orange-950'
                    : 'border-gray-200 dark:border-gray-700 hover:border-orange-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                {file ? (
                  <>
                    <FileText size={48} className="text-orange-700 dark:text-orange-400 mb-4" />
                    <p className="font-bold text-orange-900 dark:text-orange-200">{file.name}</p>
                    <p className="text-xs text-orange-700 dark:text-orange-400">
                      Click to change file
                    </p>
                  </>
                ) : (
                  <>
                    <span className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                      <FileUp size={32} className="text-gray-400 dark:text-gray-500" />
                    </span>
                    <p className="font-bold text-gray-900 dark:text-gray-100">Choose a PDF file</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Maximum size: 10MB</p>
                  </>
                )}
              </button>
            </>
          )}

          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-300 text-sm rounded-xl border border-red-100 dark:border-red-900">
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

          {mode === 'search' && (
            <div className="text-center">
              <button
                type="button"
                onClick={() => void handleAddWithoutAi()}
                disabled={isLoading || !query.trim()}
                className="text-sm font-bold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 disabled:opacity-40 transition-colors underline underline-offset-4"
              >
                Add without AI
              </button>
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                No API key needed. You can summarise it later from the book&rsquo;s page.
              </p>
            </div>
          )}
        </form>
      )}
    </Dialog>
  );
};
