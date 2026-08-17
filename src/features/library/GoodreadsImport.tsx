import { useRef, useState } from 'react';
import { FileUp, Loader2, Upload } from 'lucide-react';
import { parseGoodreadsCsv } from '../../lib/goodreads';
import type { GoodreadsParseResult } from '../../lib/goodreads';
import { useLibrary } from './useLibrary';
import { toast } from '../../components/ui/toastStore';

interface GoodreadsImportProps {
  onDone: () => void;
}

/** Goodreads exports a ~250-byte row per book, so this clears a 20,000-book library. */
const MAX_CSV_BYTES = 10 * 1024 * 1024;

export function GoodreadsImport({ onDone }: GoodreadsImportProps) {
  const { importGoodreadsRows } = useLibrary();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<GoodreadsParseResult | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  /**
   * The accept attribute on a file input is a filter in the picker dialog, not a
   * guarantee — a user can pick anything, and drag-and-drop bypasses it entirely.
   * Reading 400MB of video into a string to look for commas hangs the tab before
   * the parser ever sees it, so size is checked before the bytes are read.
   */
  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Cleared immediately so picking the *same* file again still fires a change
    // event. Without this, anyone who hit an error, fixed the file and re-picked
    // it got no response at all and no way to tell why.
    event.target.value = '';
    if (!file) return;

    if (file.size > MAX_CSV_BYTES) {
      toast.error(
        `That file is ${Math.round(file.size / 1024 / 1024)}MB. A Goodreads export of a large library is well under ${MAX_CSV_BYTES / 1024 / 1024}MB.`,
      );
      return;
    }
    if (file.size === 0) {
      toast.error('That file is empty.');
      return;
    }

    try {
      const parsed = parseGoodreadsCsv(await file.text());

      if (parsed.unrecognised) {
        // Distinct from "no books": a CSV with no Title column is the wrong file,
        // and telling the user their library looks empty sends them hunting in
        // the wrong direction.
        toast.error('That CSV has no Title column, so it is not a Goodreads export.');
        return;
      }

      setPreview(parsed);
      setFilename(file.name);
      if (parsed.rows.length === 0) {
        toast.error('No books found in that file. Is it a Goodreads CSV export?');
      }
    } catch {
      toast.error('Could not read that file.');
    }
  };

  const handleImport = async () => {
    if (!preview || preview.rows.length === 0) return;
    setIsImporting(true);
    try {
      const { added, duplicates } = await importGoodreadsRows(preview.rows);
      toast.success(
        `Imported ${added} book${added === 1 ? '' : 's'}` +
          (duplicates > 0 ? `, skipped ${duplicates} already in your library.` : '.'),
      );
      onDone();
    } catch (error) {
      // try/finally with no catch meant a failed import — a quota-exceeded
      // IndexedDB write on a 300-book file is the obvious case — just stopped
      // the spinner. No toast, no books, no way to tell success from failure.
      console.error('[booksum] Goodreads import failed', error);
      toast.error('Could not import that library. Nothing was added.');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
        Export your Goodreads library from{' '}
        <span className="font-semibold">My Books &rarr; Import and export</span>, then drop the CSV
        here. Books are added instantly and cost nothing &mdash; summaries are generated later, only
        for the books you open.
      </p>

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="w-full border-2 border-dashed rounded-3xl p-10 flex flex-col items-center justify-center transition-all border-gray-200 dark:border-gray-700 hover:border-orange-400 hover:bg-gray-50 dark:hover:bg-gray-800"
      >
        <input
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          ref={fileInputRef}
          onChange={(event) => void handleFile(event)}
        />
        <span className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
          <FileUp size={32} className="text-gray-400 dark:text-gray-500" />
        </span>
        <span className="font-bold text-gray-900 dark:text-gray-100">
          {filename ?? 'Choose your goodreads_library_export.csv'}
        </span>
      </button>

      {preview && (
        <div
          role="status"
          className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-800 text-sm space-y-1"
        >
          <p className="font-bold text-gray-900 dark:text-gray-100">
            {preview.rows.length} book{preview.rows.length === 1 ? '' : 's'} found
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            {preview.rows.filter((r) => r.status === 'Finished').length} finished,{' '}
            {preview.rows.filter((r) => r.status === 'Want to Read').length} to read
            {preview.skipped > 0 ? `, ${preview.skipped} rows skipped` : ''}
          </p>
          {/* What the books will actually look like afterwards, which is the
              thing being decided here. Books whose shelves say nothing land in
              'Other', and nothing arrives summarised — importing is free
              precisely because no AI call is made. */}
          <p className="text-gray-500 dark:text-gray-500 text-xs mt-2">
            {preview.rows.filter((r) => !r.category).length > 0
              ? `${preview.rows.filter((r) => !r.category).length} will land in "Other" — the rest keep their Goodreads shelf as a category. `
              : 'Each keeps its Goodreads shelf as a category. '}
            None arrive summarised; that is why importing costs nothing.
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={() => void handleImport()}
        disabled={!preview || preview.rows.length === 0 || isImporting}
        className="w-full py-4 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white rounded-2xl font-bold text-lg shadow-lg shadow-orange-200 transition-all flex items-center justify-center gap-2"
      >
        {isImporting ? <Loader2 size={20} className="animate-spin" /> : <Upload size={20} />}
        {isImporting ? 'Importing…' : 'Import library'}
      </button>
    </div>
  );
}
