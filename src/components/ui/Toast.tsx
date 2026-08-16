import { useEffect, useSyncExternalStore } from 'react';
import { AlertCircle, CheckCircle, Info, X } from 'lucide-react';
import { dismissToast, getToasts, subscribeToToasts } from './toastStore';
import type { ToastKind } from './toastStore';

const DISMISS_AFTER_MS = 6000;

const STYLES: Record<ToastKind, { wrapper: string; icon: typeof AlertCircle }> = {
  error: {
    wrapper:
      'bg-red-50 border-red-100 text-red-700 dark:bg-red-950 dark:border-red-900 dark:text-red-200',
    icon: AlertCircle,
  },
  success: {
    wrapper:
      'bg-emerald-50 border-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:border-emerald-900 dark:text-emerald-200',
    icon: CheckCircle,
  },
  info: {
    wrapper:
      'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 text-gray-700 dark:text-gray-300',
    icon: Info,
  },
};

/**
 * One toast, owning its own dismissal countdown.
 *
 * The timers used to live in a single effect on the host keyed on the whole
 * `toasts` array. Every push produced a new array, so the cleanup cleared every
 * running timer and started them all again — a toast with one second left got a
 * fresh six. Fire four errors in a row and the first one outlives the last.
 * Per-instance effects with an empty dependency list cannot do that: a toast's
 * clock starts when it mounts and is untouched by its neighbours.
 */
function Toast({ id, kind, message }: { id: string; kind: ToastKind; message: string }) {
  useEffect(() => {
    const timer = setTimeout(() => dismissToast(id), DISMISS_AFTER_MS);
    return () => clearTimeout(timer);
  }, [id]);

  const style = STYLES[kind];
  const Icon = style.icon;

  return (
    <div
      role="status"
      aria-live={kind === 'error' ? 'assertive' : 'polite'}
      className={`flex items-start gap-3 p-4 rounded-2xl border shadow-lg animate-in slide-in-from-bottom-4 duration-200 ${style.wrapper}`}
    >
      <Icon size={18} className="mt-0.5 shrink-0" />
      <p className="text-sm font-medium flex-1">{message}</p>
      <button
        onClick={() => dismissToast(id)}
        aria-label="Dismiss notification"
        className="p-1 rounded-full hover:bg-black/5 transition-colors shrink-0"
      >
        <X size={16} />
      </button>
    </div>
  );
}

export function ToastHost() {
  const toasts = useSyncExternalStore(subscribeToToasts, getToasts, getToasts);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 sm:left-auto sm:right-6 sm:translate-x-0 z-[60] flex flex-col gap-3 w-[min(92vw,26rem)]">
      {toasts.map((item) => (
        <Toast key={item.id} id={item.id} kind={item.kind} message={item.message} />
      ))}
    </div>
  );
}
