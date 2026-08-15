import { toAiError } from '../../lib/ai/errors';

/**
 * A global open-the-key-dialog signal, in the same shape as `toastStore`.
 *
 * The shell owned this behaviour and handed it down as an `onAiError` prop, so
 * only the call sites that happened to be threaded could route the user to the
 * dialog. Narration in the book view, narration in the reader, and quiz
 * generation all mapped the error themselves and showed a toast saying to add a
 * key, with nowhere to add one. A missing key is the single most recoverable
 * failure in the app, and three of its six call sites were dead ends.
 */
type Listener = () => void;

let listeners: Listener[] = [];

export const keyDialog = {
  open() {
    for (const listener of listeners) listener();
  },
  subscribe(listener: Listener): () => void {
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((entry) => entry !== listener);
    };
  },
};

/**
 * Maps any thrown value to a user-facing message, and opens the key dialog for
 * the two kinds the user can actually do something about. Use this instead of
 * `toAiError(...).message` at any UI call site.
 */
export function reportAiError(error: unknown): string {
  const aiError = toAiError(error);
  if (aiError.kind === 'missing-key' || aiError.kind === 'invalid-key') {
    keyDialog.open();
  }
  return aiError.message;
}
