/**
 * @vitest-environment node
 *
 * No DOM here, so this suite skips the jsdom window the default environment
 * builds. See src/test/setup.ts.
 */
import { describe, expect, it } from 'vitest';
import { base64ToBytes, bytesToBase64, tryBase64ToBytes } from './base64';

describe('base64', () => {
  it('round-trips arbitrary bytes', () => {
    const bytes = new Uint8Array([0, 1, 127, 128, 255, 42]);
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
  });

  it('decodes a known value', () => {
    expect(new TextDecoder().decode(base64ToBytes('Qm9va1N1bQ=='))).toBe('BookSum');
  });

  it('throws on input outside the alphabet', () => {
    // Documented here because the signature reads as total and is not: this is
    // fed legacy localStorage written by a different version of the app, so
    // "not valid base64" is a state that actually occurs.
    expect(() => base64ToBytes('!!! not base64 !!!')).toThrow();
  });
});

describe('tryBase64ToBytes', () => {
  it('decodes valid input', () => {
    const bytes = tryBase64ToBytes('Qm9va1N1bQ==');
    // Asserted rather than `!`-ed. Returning null for input it cannot decode is
    // half of what this function is for, so "it returned something at all" is
    // itself part of the behaviour under test.
    expect(bytes).not.toBeNull();
    expect(new TextDecoder().decode(bytes as Uint8Array)).toBe('BookSum');
  });

  it('returns null instead of throwing', () => {
    // Every caller was wrapping base64ToBytes in its own try/catch, which is the
    // shape of a function whose type is lying about what it can do.
    expect(tryBase64ToBytes('!!! not base64 !!!')).toBeNull();
  });

  it('treats absent input as nothing to decode', () => {
    expect(tryBase64ToBytes(undefined)).toBeNull();
    expect(tryBase64ToBytes('')).toBeNull();
  });
});
