import { useEffect, useSyncExternalStore } from 'react';
import { AlertCircle, CheckCircle, Info, X } from 'lucide-react';
import { dismissToast, getToasts, subscribeToToasts } from './toastStore';
import type { ToastKind } from './toastStore';

const DISMISS_AFTER_MS = 6000;

const STYLES: Record<ToastKind, { wrapper: string; icon: typeof AlertCircle }> = {
  error: { wrapper: 'bg-red-50 border-red-100 text-red-700', icon: AlertCircle },
  success: { wrapper: 'bg-emerald-50 border-emerald-100 text-emerald-700', icon: CheckCircle },
  info: { wrapper: 'bg-white border-gray-100 text-gray-700', icon: Info },
};

export function ToastHost() {
  const toasts = useSyncExternalStore(subscribeToToasts, getToasts, getToasts);

  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((item) => setTimeout(() => dismissToast(item.id), DISMISS_AFTER_MS));
    return () => timers.forEach(clearTimeout);
  }, [toasts]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 sm:left-auto sm:right-6 sm:translate-x-0 z-[60] flex flex-col gap-3 w-[min(92vw,26rem)]">
      {toasts.map((item) => {
        const style = STYLES[item.kind];
        const Icon = style.icon;
        return (
          <div
            key={item.id}
            role="status"
            aria-live={item.kind === 'error' ? 'assertive' : 'polite'}
            className={`flex items-start gap-3 p-4 rounded-2xl border shadow-lg animate-in slide-in-from-bottom-4 duration-200 ${style.wrapper}`}
          >
            <Icon size={18} className="mt-0.5 shrink-0" />
            <p className="text-sm font-medium flex-1">{item.message}</p>
            <button
              onClick={() => dismissToast(item.id)}
              aria-label="Dismiss notification"
              className="p-1 rounded-full hover:bg-black/5 transition-colors shrink-0"
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
