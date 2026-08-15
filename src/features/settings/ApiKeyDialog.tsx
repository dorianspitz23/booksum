import { useState } from 'react';
import type { FormEvent } from 'react';
import { ExternalLink, Loader2, ShieldAlert } from 'lucide-react';
import { setApiKey } from '../../lib/ai/apiKey';
import { resetClientCache, testApiKey } from '../../lib/ai/client';
import { toAiError } from '../../lib/ai/errors';
import { Dialog } from '../../components/ui/Dialog';

interface ApiKeyDialogProps {
  onClose: () => void;
  onSaved?: () => void;
}

export function ApiKeyDialog({ onClose, onSaved }: ApiKeyDialogProps) {
  const [value, setValue] = useState('');
  const [status, setStatus] = useState<'idle' | 'testing' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!value.trim()) return;

    setStatus('testing');
    setMessage(null);
    try {
      await testApiKey(value);
      setApiKey(value);
      resetClientCache();
      onSaved?.();
      onClose();
    } catch (error) {
      setStatus('error');
      setMessage(toAiError(error).message);
    }
  };

  return (
    <Dialog open title="Connect Gemini" onClose={onClose} size="max-w-lg">
      <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
        BookSum uses Google&rsquo;s Gemini to write summaries, narrate them, and answer questions
        about your books. Bring your own key &mdash; it is stored in this browser only and is sent
        nowhere except Google.
      </p>

      <a
        href="https://aistudio.google.com/apikey"
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-orange-700 dark:text-orange-400 hover:text-orange-800 mb-6"
      >
        Get a free key <ExternalLink size={14} />
      </a>

      <form onSubmit={handleSave} className="space-y-4">
        <input
          type="password"
          autoComplete="off"
          aria-label="Gemini API key"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="AIza..."
          className="w-full px-4 py-4 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none font-mono text-sm"
        />

        {message && (
          <p className="flex items-start gap-2 p-4 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 text-sm rounded-xl border border-red-100 dark:border-red-900">
            <ShieldAlert size={16} className="mt-0.5 shrink-0" /> {message}
          </p>
        )}

        <button
          type="submit"
          disabled={!value.trim() || status === 'testing'}
          className="w-full py-4 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white rounded-2xl font-bold shadow-lg shadow-orange-200 transition-all flex items-center justify-center gap-2"
        >
          {status === 'testing' && <Loader2 size={18} className="animate-spin" />}
          {status === 'testing' ? 'Testing key…' : 'Test and save'}
        </button>
      </form>
    </Dialog>
  );
}
