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

function push(kind: ToastKind, message: string) {
  toasts = [...toasts, { id: newId(), kind, message }];
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
