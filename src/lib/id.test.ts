import { afterEach, describe, expect, it, vi } from 'vitest';
import { newId } from './id';

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('newId', () => {
  it('returns a v4 UUID', () => {
    expect(newId()).toMatch(V4);
  });

  it('returns a v4 UUID when crypto.randomUUID is unavailable', () => {
    // randomUUID is gated on a secure context: it is absent over plain http,
    // which is where the app used to throw on its very first write.
    vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) });

    expect(newId()).toMatch(V4);
  });

  it('does not repeat itself across many calls without randomUUID', () => {
    vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) });

    const seen = new Set(Array.from({ length: 500 }, () => newId()));
    expect(seen.size).toBe(500);
  });

  it('falls back again when crypto is missing entirely', () => {
    vi.stubGlobal('crypto', undefined);

    expect(newId()).toMatch(V4);
  });
});
