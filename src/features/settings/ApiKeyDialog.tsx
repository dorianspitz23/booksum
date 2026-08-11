import { useState } from 'react';
import type { FormEvent } from 'react';
import { ExternalLink, Loader2, ShieldAlert, X } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { setApiKey } from '../../lib/ai/apiKey';
import { resetClientCache } from '../../lib/ai/client';
import { MODELS } from '../../lib/ai/models';
import { toAiError } from '../../lib/ai/errors';

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
      const probe = new GoogleGenAI({ apiKey: value.trim() });
      await probe.models.generateContent({ model: MODELS.summary, contents: 'ping' });
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl p-6 sm:p-8">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-2xl font-bold text-gray-900">Connect Gemini</h2>
          <button onClick={onClose} aria-label="Close" className="p-2 hover:bg-gray-100 rounded-full">
            <X size={20} />
          </button>
        </div>

        <p className="text-sm text-gray-600 leading-relaxed mb-4">
          BookSum uses Google&rsquo;s Gemini to write summaries, narrate them, and answer questions
          about your books. Bring your own key &mdash; it is stored in this browser only and is sent
          nowhere except Google.
        </p>

        <a
          href="https://aistudio.google.com/apikey"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-orange-700 hover:text-orange-800 mb-6"
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
            className="w-full px-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none font-mono text-sm"
          />

          {message && (
            <p className="flex items-start gap-2 p-4 bg-red-50 text-red-700 text-sm rounded-xl border border-red-100">
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
      </div>
    </div>
  );
}
