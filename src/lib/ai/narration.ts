import { generateAudioSummary } from './tts';
import { blobs } from '../storage/repo';
import type { Book, BlobKind, Summary, VoiceName } from '../../types';

export type NarrationType = 'short' | 'long';

const kindFor = (type: NarrationType): BlobKind =>
  type === 'short' ? 'audio-short' : 'audio-long';

/**
 * The voice is recorded as a MIME parameter on the stored blob so that changing
 * the profile's voice invalidates the cache rather than silently replaying the
 * old one. `audio/wav;voice=Kore` is well-formed and survives the round trip.
 */
// Compared case-insensitively: the Blob constructor lowercases `type`, so a tag
// written as `voice=Kore` reads back as `voice=kore` and a naive equality check
// misses every time -- which silently defeated the cache entirely.
const mimeFor = (voice: VoiceName) => `audio/wav;voice=${voice}`;
const voiceOf = (mime: string) => mime.split('voice=')[1]?.trim().toLowerCase();
const isVoice = (mime: string, voice: VoiceName) => voiceOf(mime) === voice.toLowerCase();

/**
 * Narration used to be regenerated on every single play. The blob store already
 * had `audio-short` and `audio-long` kinds reserved for it and nothing ever wrote
 * to them, so every replay of the same summary was another paid TTS call.
 */
export async function getOrCreateNarration(
  book: Book,
  summary: Summary,
  type: NarrationType,
  voice: VoiceName,
): Promise<Blob> {
  const kind = kindFor(type);

  const cached = await blobs.get(book.id, kind);
  if (cached && isVoice(cached.type, voice)) return cached;

  const fresh = await generateAudioSummary(book, summary, type, voice);
  const tagged = new Blob([await fresh.arrayBuffer()], { type: mimeFor(voice) });
  await blobs.put(book.id, kind, tagged);
  return tagged;
}

/** Drops any cached narration for a book, e.g. after its summary is regenerated. */
export async function clearNarration(bookId: string): Promise<void> {
  await blobs.remove(bookId, 'audio-short');
  await blobs.remove(bookId, 'audio-long');
}
