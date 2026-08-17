import { newId } from '../../lib/id';

export type ToastKind = 'error' | 'success' | 'info';

export interface ToastMessage {
  id: string;
  kind: ToastKind;
  message: string;
}

let toasts: ToastMessage[] = [];
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

/**
 * The queue is capped, oldest dropped first.
 *
 * It was unbounded, and the thing most likely to fill it is the thing it exists
 * to report: a failing import or a dead provider raises one toast per item, so
 * a 300-book Goodreads import against a broken network stacked 300 of them —
 * a full-screen wall of identical messages with the app behind it unreachable.
 * Four is enough to see that several things failed; the fifth adds nothing.
 */
const MAX_TOASTS = 4;

function push(kind: ToastKind, message: string) {
  toasts = [...toasts, { id: newId(), kind, message }].slice(-MAX_TOASTS);
  emit();
}

export const toast = {
  error: (message: string) => push('error', message),
  success: (message: string) => push('success', message),
  info: (message: string) => push('info', message),
};

export const getToasts = (): ToastMessage[] => toasts;

export function dismissToast(id: string) {
  toasts = toasts.filter((item) => item.id !== id);
  emit();
}

export function clearToasts() {
  toasts = [];
  emit();
}

export function subscribeToToasts(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
