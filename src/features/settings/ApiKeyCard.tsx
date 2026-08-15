import { useEffect, useState } from 'react';
import { KeyRound } from 'lucide-react';
import { getApiKey, clearApiKey, subscribeToApiKey } from '../../lib/ai/apiKey';
import { keyDialog } from './keyDialog';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { toast } from '../../components/ui/toastStore';

/**
 * The settings surface for the Gemini key.
 *
 * `apiKey.ts` had a complete API — read, set, clear, subscribe — and the dialog
 * to enter one, but the only way to reach either was to trigger an AI error.
 * There was no way to check whether a key was saved, replace one, or remove it
 * before handing the machine to someone else.
 */
function maskKey(key: string): string {
  // Enough to recognise which key is saved, not enough to be worth screenshotting.
  return key.length <= 8 ? '••••' : `${key.slice(0, 4)}••••••••${key.slice(-4)}`;
}

export function ApiKeyCard() {
  const [key, setKey] = useState<string | null>(() => getApiKey());
  const confirm = useConfirm();

  useEffect(() => subscribeToApiKey(() => setKey(getApiKey())), []);

  const remove = async () => {
    const proceed = await confirm({
      title: 'Remove your API key?',
      body: 'AI features stop working until you add a key again. Your library, notes and review schedule are not affected.',
      confirmLabel: 'Remove key',
      danger: true,
    });
    if (!proceed) return;

    clearApiKey();
    toast.success('API key removed from this browser.');
  };

  return (
    <div className="bg-white dark:bg-gray-900 p-8 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex-1">
          <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-1 flex items-center gap-2">
            <KeyRound size={18} className="text-gray-400 dark:text-gray-500" />
            Gemini API key
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {key ? (
              <>
                Saved in this browser only:{' '}
                <code className="font-mono text-gray-700 dark:text-gray-300">{maskKey(key)}</code>.
                It is never sent anywhere except Google.
              </>
            ) : (
              'No key saved. Everything except the AI features works without one.'
            )}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => keyDialog.open()}
            className="px-5 py-3 rounded-xl bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm font-bold hover:opacity-90 transition-opacity"
          >
            {key ? 'Replace key' : 'Add key'}
          </button>
          {key && (
            <button
              onClick={() => void remove()}
              className="px-5 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Remove
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
