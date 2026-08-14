/**
 * @vitest-environment node
 *
 * No DOM here, so this suite skips the jsdom window the default environment
 * builds. See src/test/setup.ts.
 */
import { describe, expect, it } from 'vitest';
import { base64ToBytes, bytesToBase64 } from './base64';

describe('base64', () => {
  it('round-trips arbitrary bytes', () => {
    const bytes = new Uint8Array([0, 1, 127, 128, 255, 42]);
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
  });

  it('decodes a known value', () => {
    expect(new TextDecoder().decode(base64ToBytes('Qm9va1N1bQ=='))).toBe('BookSum');
  });
});
