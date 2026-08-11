const SAMPLE_RATE = 24_000;
const NUM_CHANNELS = 1;
const BITS_PER_SAMPLE = 16;

function writeString(view: DataView, offset: number, value: string) {
  for (let i = 0; i < value.length; i += 1) {
    view.setUint8(offset + i, value.charCodeAt(i));
  }
}

/** Gemini TTS returns headerless 24kHz mono 16-bit PCM; browsers need a RIFF header. */
export function pcmToWavBlob(pcm: Uint8Array<ArrayBuffer>): Blob {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const byteRate = SAMPLE_RATE * NUM_CHANNELS * (BITS_PER_SAMPLE / 8);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + pcm.length, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, NUM_CHANNELS, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, NUM_CHANNELS * (BITS_PER_SAMPLE / 8), true);
  view.setUint16(34, BITS_PER_SAMPLE, true);
  writeString(view, 36, 'data');
  view.setUint32(40, pcm.length, true);

  return new Blob([header, pcm], { type: 'audio/wav' });
}
