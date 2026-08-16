const DEFAULT_SAMPLE_RATE = 24_000;
const NUM_CHANNELS = 1;
const BITS_PER_SAMPLE = 16;

/**
 * Reads the sample rate out of a Gemini inline-data MIME type, e.g.
 * `audio/L16;codec=pcm;rate=24000`.
 *
 * The rate used to be hardcoded here while the reported MIME type was discarded
 * entirely, so a change at Google's end would have written a header claiming
 * 24kHz over data at some other rate — audio that plays at the wrong speed, with
 * nothing anywhere reporting a problem. Returns null when the payload is not
 * 16-bit linear PCM at all, which is a case worth refusing rather than guessing.
 */
export function pcmRateFromMimeType(mimeType: string | undefined): number | null {
  if (!mimeType) return DEFAULT_SAMPLE_RATE;

  const lower = mimeType.toLowerCase();
  // L16 is the 16-bit linear PCM this encoder writes a header for. Anything
  // else — Opus, MP3, a 24-bit variant — needs a different container entirely,
  // and wrapping it in a RIFF header would produce confident noise.
  if (!lower.includes('l16') && !lower.includes('pcm')) return null;

  const rate = /rate=(\d+)/.exec(lower)?.[1];
  if (!rate) return DEFAULT_SAMPLE_RATE;

  const parsed = Number(rate);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_SAMPLE_RATE;
}

function writeString(view: DataView, offset: number, value: string) {
  for (let i = 0; i < value.length; i += 1) {
    view.setUint8(offset + i, value.charCodeAt(i));
  }
}

/** Gemini TTS returns headerless mono 16-bit PCM; browsers need a RIFF header. */
export function pcmToWavBlob(
  pcm: Uint8Array<ArrayBuffer>,
  sampleRate: number = DEFAULT_SAMPLE_RATE,
): Blob {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const byteRate = sampleRate * NUM_CHANNELS * (BITS_PER_SAMPLE / 8);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + pcm.length, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, NUM_CHANNELS, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, NUM_CHANNELS * (BITS_PER_SAMPLE / 8), true);
  view.setUint16(34, BITS_PER_SAMPLE, true);
  writeString(view, 36, 'data');
  view.setUint32(40, pcm.length, true);

  return new Blob([header, pcm], { type: 'audio/wav' });
}
