/**
 * @vitest-environment node
 *
 * No DOM here, so this suite skips the jsdom window the default environment
 * builds. See src/test/setup.ts.
 */
import { describe, expect, it } from 'vitest';
import { pcmRateFromMimeType, pcmToWavBlob } from './wav';

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

/**
 * The rate was hardcoded here while the model's reported MIME type was thrown
 * away entirely. A change at Google's end would have written a header claiming
 * 24kHz over samples at some other rate — narration that plays fast or slow with
 * nothing anywhere reporting a fault. A codec change would have been worse: a
 * RIFF header wrapped around Opus or MP3 is confident noise.
 */
describe('pcmRateFromMimeType', () => {
  it('reads the rate Gemini actually reports', () => {
    expect(pcmRateFromMimeType('audio/L16;codec=pcm;rate=24000')).toBe(24_000);
    expect(pcmRateFromMimeType('audio/L16;codec=pcm;rate=48000')).toBe(48_000);
  });

  it('is case-insensitive, because a MIME type is', () => {
    expect(pcmRateFromMimeType('AUDIO/L16;CODEC=PCM;RATE=16000')).toBe(16_000);
  });

  it('falls back to 24kHz when the type is PCM but carries no rate', () => {
    expect(pcmRateFromMimeType('audio/L16;codec=pcm')).toBe(24_000);
  });

  it('falls back to 24kHz when nothing is reported at all', () => {
    expect(pcmRateFromMimeType(undefined)).toBe(24_000);
  });

  it.each(['audio/mpeg', 'audio/ogg;codecs=opus', 'audio/webm', 'text/plain'])(
    'refuses %s rather than wrapping it in a RIFF header',
    (mime) => {
      expect(pcmRateFromMimeType(mime)).toBeNull();
    },
  );
});

describe('pcmToWavBlob sample rate', () => {
  it('writes the rate it is given into both header fields', async () => {
    const view = await headerOf(pcmToWavBlob(new Uint8Array(new ArrayBuffer(8)), 48_000));
    expect(view.getUint32(24, true)).toBe(48_000);
    // Byte rate has to move with it or players read the duration wrong.
    expect(view.getUint32(28, true)).toBe(48_000 * 2);
  });

  it('still defaults to 24kHz when no rate is passed', async () => {
    const view = await headerOf(pcmToWavBlob(new Uint8Array(new ArrayBuffer(8))));
    expect(view.getUint32(24, true)).toBe(24_000);
  });
});
