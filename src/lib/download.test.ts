import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadBytes, downloadText, slugify } from './download';

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Atomic Habits')).toBe('atomic-habits');
  });

  it('strips punctuation and collapses separators', () => {
    expect(slugify('Sapiens: A Brief History!!')).toBe('sapiens-a-brief-history');
  });

  it('trims leading and trailing hyphens', () => {
    expect(slugify('  --Deep Work--  ')).toBe('deep-work');
  });

  it('falls back for an empty result', () => {
    expect(slugify('!!!')).toBe('untitled');
  });

  it('caps the length', () => {
    expect(slugify('a'.repeat(200)).length).toBeLessThanOrEqual(60);
  });
});

describe('downloadText', () => {
  // The export path had no coverage at all: only slugify was tested, so the
  // half that actually produces the file — the anchor, the object URL, and the
  // deferred revoke that a race once broke — was never exercised.
  const created: string[] = [];
  const revoked: string[] = [];
  let clicked: HTMLAnchorElement | null = null;

  beforeEach(() => {
    created.length = 0;
    revoked.length = 0;
    clicked = null;

    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
      const url = `blob:test/${created.length}`;
      created.push(url);
      return url;
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation((url: string) => {
      revoked.push(url);
    });
    // Reads the anchor out of the document rather than aliasing `this`.
    // downloadText appends it before clicking and removes it after, so this is
    // the only moment it is reachable — which is also what makes the
    // "leaves nothing behind" test below meaningful.
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
      clicked = document.querySelector('a[download]');
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('names the file from filename and puts contents in the blob', () => {
    downloadText({ filename: 'my-book.md', contents: '# Hello' });

    expect(clicked).not.toBeNull();
    expect(clicked?.download).toBe('my-book.md');
    expect(clicked?.href).toContain('blob:test/');
    expect(created).toHaveLength(1);
  });

  it('leaves nothing in the document afterwards', () => {
    downloadText({ filename: 'x.md', contents: 'x' });
    expect(document.querySelectorAll('a[download]')).toHaveLength(0);
  });

  it('defers the revoke past the click rather than racing it', () => {
    // Revoking in the same task as click() cancels the download on some
    // browsers, and to the user that looks like a button that did nothing.
    //
    // Fake timers rather than awaiting a real tick: the earlier tests in this
    // block each leave a pending revoke, and a real await lets those fire into
    // this test's arrays. That is the flake, not the code.
    vi.useFakeTimers();
    try {
      downloadText({ filename: 'x.md', contents: 'x' });
      expect(revoked).toHaveLength(0);

      vi.runAllTimers();
      expect(revoked).toEqual(created);
    } finally {
      vi.useRealTimers();
    }
  });

  it('honours an explicit mime type', () => {
    const spy = vi.spyOn(globalThis, 'Blob');
    downloadText({ filename: 'x.json', contents: '{}', mimeType: 'application/json' });
    expect(spy).toHaveBeenCalledWith(['{}'], { type: 'application/json;charset=utf-8' });
  });

  describe('downloadBytes', () => {
    const bytes = () => new Uint8Array([0x50, 0x4b, 0x03, 0x04]);

    it('names the file and hands the bytes to the blob', () => {
      const spy = vi.spyOn(globalThis, 'Blob');
      const payload = bytes();
      downloadBytes({ filename: 'library.zip', bytes: payload });

      expect(clicked?.download).toBe('library.zip');
      expect(spy).toHaveBeenCalledWith([payload], { type: 'application/zip' });
    });

    it('does not append a charset to a binary type', () => {
      // `application/zip;charset=utf-8` is meaningless, and some tools take the
      // charset as a hint that the body is text and re-encode it.
      const spy = vi.spyOn(globalThis, 'Blob');
      downloadBytes({ filename: 'x.zip', bytes: bytes() });

      expect(spy.mock.calls[0]?.[1]).toEqual({ type: 'application/zip' });
    });

    it('leaves nothing in the document afterwards', () => {
      downloadBytes({ filename: 'x.zip', bytes: bytes() });
      expect(document.querySelectorAll('a[download]')).toHaveLength(0);
    });

    it('defers the revoke past the click rather than racing it', () => {
      vi.useFakeTimers();
      try {
        downloadBytes({ filename: 'x.zip', bytes: bytes() });
        expect(revoked).toHaveLength(0);

        vi.runAllTimers();
        expect(revoked).toEqual(created);
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
