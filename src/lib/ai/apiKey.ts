export { API_KEY as API_KEY_STORAGE_KEY } from '../storageKeys';
import { API_KEY as API_KEY_STORAGE_KEY } from '../storageKeys';

const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

export function getApiKey(): string | null {
  const value = localStorage.getItem(API_KEY_STORAGE_KEY)?.trim();
  return value ? value : null;
}

export function hasApiKey(): boolean {
  return getApiKey() !== null;
}

export function setApiKey(key: string): void {
  const trimmed = key.trim();
  if (trimmed) localStorage.setItem(API_KEY_STORAGE_KEY, trimmed);
  else localStorage.removeItem(API_KEY_STORAGE_KEY);
  notify();
}

export function clearApiKey(): void {
  localStorage.removeItem(API_KEY_STORAGE_KEY);
  notify();
}

export function subscribeToApiKey(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
