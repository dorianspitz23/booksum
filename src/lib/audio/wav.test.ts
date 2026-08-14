/**
 * @vitest-environment node
 *
 * No DOM here, so this suite skips the jsdom window the default environment
 * builds. See src/test/setup.ts.
 */
import { describe, expect, it } from 'vitest';
import { pcmToWavBlob } from './wav';

async function headerOf(blob: Blob) {
  return new DataView(await blob.slice(0, 44).arrayBuffer());
}

const ascii = (view: DataView, offset: number, length: number) =>
  Array.from({ length }, (_, i) => String.fromCharCode(view.getUint8(offset + i))).join('');

describe('pcmToWavBlob', () => {
  it('produces a RIFF/WAVE container of the right size', async () => {
    const pcm = new Uint8Array(new ArrayBuffer(1000));
    const blob = pcmToWavBlob(pcm);

    expect(blob.type).toBe('audio/wav');
    expect(blob.size).toBe(44 + pcm.length);

    const view = await headerOf(blob);
    expect(ascii(view, 0, 4)).toBe('RIFF');
    expect(ascii(view, 8, 4)).toBe('WAVE');
    expect(ascii(view, 36, 4)).toBe('data');
    expect(view.getUint32(4, true)).toBe(36 + pcm.length);
    expect(view.getUint32(40, true)).toBe(pcm.length);
  });

  it('declares 24kHz mono 16-bit PCM', async () => {
    const view = await headerOf(pcmToWavBlob(new Uint8Array(new ArrayBuffer(8))));
    expect(view.getUint16(20, true)).toBe(1);
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(24_000);
    expect(view.getUint16(34, true)).toBe(16);
    expect(view.getUint32(28, true)).toBe(24_000 * 2);
  });
});
