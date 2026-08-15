/**
 * @vitest-environment node
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchJsonOrNull } from './http';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('fetchJsonOrNull', () => {
  it('returns the parsed body on success', async () => {
    globalThis.fetch = vi.fn(async () => new Response('{"ok":true}', { status: 200 })) as never;

    await expect(fetchJsonOrNull<{ ok: boolean }>('https://example.test')).resolves.toEqual({
      ok: true,
    });
  });

  it('returns null on a non-2xx response', async () => {
    globalThis.fetch = vi.fn(async () => new Response('nope', { status: 503 })) as never;

    await expect(fetchJsonOrNull('https://example.test')).resolves.toBeNull();
  });

  it('returns null when the body is not JSON', async () => {
    globalThis.fetch = vi.fn(async () => new Response('<html>rate limited</html>')) as never;

    // Providers answer 200 with an HTML error page often enough that this needs
    // to be a fallback rather than an exception the caller has to catch.
    await expect(fetchJsonOrNull('https://example.test')).resolves.toBeNull();
  });

  it('returns null when the network rejects', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    }) as never;

    await expect(fetchJsonOrNull('https://example.test')).resolves.toBeNull();
  });

  it('aborts and returns null when the provider never answers', async () => {
    // The reason this helper exists: fetch has no default timeout, so a provider
    // that accepts the connection and then goes quiet leaves the promise pending
    // forever -- and the add-book spinner with it.
    globalThis.fetch = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    ) as never;

    await expect(fetchJsonOrNull('https://example.test', 20)).resolves.toBeNull();
  });

  it('passes an abort signal so the request is actually cancelled', async () => {
    const spy = vi.fn(async (_url: string, _init?: RequestInit) => new Response('{}'));
    globalThis.fetch = spy as never;

    await fetchJsonOrNull('https://example.test');

    // Without a signal the timer would fire and be ignored — the request would
    // keep running and the timeout would be decorative.
    expect(spy.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
  });
});
