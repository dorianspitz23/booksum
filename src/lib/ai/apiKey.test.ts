import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  API_KEY_STORAGE_KEY,
  clearApiKey,
  getApiKey,
  hasApiKey,
  setApiKey,
  subscribeToApiKey,
} from './apiKey';
import { getClient, resetClientCache } from './client';
import { MissingKeyError } from './errors';

beforeEach(() => {
  localStorage.clear();
  resetClientCache();
});

describe('apiKey', () => {
  it('reports no key by default', () => {
    expect(getApiKey()).toBeNull();
    expect(hasApiKey()).toBe(false);
  });

  it('stores and reads a trimmed key', () => {
    setApiKey('  AIzaTestKey  ');
    expect(getApiKey()).toBe('AIzaTestKey');
    expect(localStorage.getItem(API_KEY_STORAGE_KEY)).toBe('AIzaTestKey');
  });

  it('treats an empty string as no key', () => {
    setApiKey('   ');
    expect(getApiKey()).toBeNull();
  });

  it('clears the key', () => {
    setApiKey('AIzaTestKey');
    clearApiKey();
    expect(hasApiKey()).toBe(false);
  });

  it('notifies subscribers on set and clear', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToApiKey(listener);

    setApiKey('AIzaTestKey');
    clearApiKey();
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    setApiKey('AIzaAnother');
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

describe('getClient', () => {
  it('throws MissingKeyError when no key is set', () => {
    expect(() => getClient()).toThrow(MissingKeyError);
  });

  it('returns a client once a key exists and caches it', () => {
    setApiKey('AIzaTestKey');
    expect(getClient()).toBe(getClient());
  });

  it('rebuilds the client when the key changes', () => {
    setApiKey('AIzaOne');
    const first = getClient();
    setApiKey('AIzaTwo');
    expect(getClient()).not.toBe(first);
  });
});
