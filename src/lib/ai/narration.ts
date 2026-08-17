import { generateAudioSummary } from './tts';
import { blobs } from '../storage/repo';
import type { Book, BlobKind, Summary, VoiceName } from '../../types';

export type NarrationType = 'short' | 'long';

const kindFor = (type: NarrationType): BlobKind =>
  type === 'short' ? 'audio-short' : 'audio-long';

/**
 * The voice that generated a cached narration is stored in its own field on the
 * blob record, so changing the profile's voice invalidates the cache rather
 * than silently replaying the old one.
 *
 * It used to ride as a `;voice=Kore` parameter on the stored MIME type, which
 * made one string do two jobs: the cache key, and the value the browser is told
 * to render those bytes as. Constraining the second (a stored MIME comes back
 * out on a same-origin `blob:` URL) broke the first, and the cache silently
 * regenerated on every play. Compared case-insensitively because the Blob
 * constructor lowercased the old tag, and records written then are still out
 * there.
 */
const sameVoice = (stored: string | undefined, voice: VoiceName) =>
  stored?.trim().toLowerCase() === voice.toLowerCase();

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

  const cached = await blobs.getWithVoice(book.id, kind);
  if (cached && sameVoice(cached.voice, voice)) return cached.blob;

  const fresh = await generateAudioSummary(book, summary, type, voice);
  await blobs.put(book.id, kind, fresh, voice);
  // Read back rather than returned directly, so the caller gets the same
  // constrained-MIME Blob every later play will get.
  return (await blobs.get(book.id, kind)) ?? fresh;
}

/** Drops any cached narration for a book, e.g. after its summary is regenerated. */
export async function clearNarration(bookId: string): Promise<void> {
  await blobs.remove(bookId, 'audio-short');
  await blobs.remove(bookId, 'audio-long');
}
