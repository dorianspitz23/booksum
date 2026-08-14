import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDb } from '../storage/db';
import { blobs, books, profiles } from '../storage/repo';
import { clearNarration, getOrCreateNarration } from './narration';
import type { Book, Summary } from '../../types';

const generateAudioSummary = vi.hoisted(() => vi.fn());
vi.mock('./tts', () => ({ generateAudioSummary }));

const summary: Summary = {
  id: 's1',
  bookId: 'b1',
  oneSentenceTakeaway: 'Small changes compound.',
  summary: 'Body',
  keyInsights: [],
  actionableSteps: [],
  generatedAt: '2026-01-01T00:00:00.000Z',
  model: 'test',
};

async function seedBook(): Promise<Book> {
  const profile = await profiles.create({ name: 'Dorian' });
  return books.create({
    profileId: profile.id,
    title: 'Atomic Habits',
    author: 'James Clear',
    category: 'Productivity',
    status: 'Finished',
    rating: 5,
    readingTimeMinutes: 12,
    coverImageUrl: '',
    hasPdf: false,
  });
}

beforeEach(async () => {
  await resetDb();
  generateAudioSummary.mockReset();
  generateAudioSummary.mockResolvedValue(new Blob(['fake wav'], { type: 'audio/wav' }));
});

/**
 * Narration used to be regenerated on every play. The blob store had audio-short
 * and audio-long kinds reserved for it and nothing ever wrote them, so replaying
 * the same summary was another paid TTS call each time.
 */
describe('getOrCreateNarration', () => {
  it('generates once and serves the second play from cache', async () => {
    const book = await seedBook();

    await getOrCreateNarration(book, summary, 'short', 'Kore');
    await getOrCreateNarration(book, summary, 'short', 'Kore');

    expect(generateAudioSummary).toHaveBeenCalledTimes(1);
  });

  it('persists the audio into the blob store', async () => {
    const book = await seedBook();

    await getOrCreateNarration(book, summary, 'short', 'Kore');

    const stored = await blobs.get(book.id, 'audio-short');
    expect(await stored?.text()).toBe('fake wav');
  });

  it('keeps short and long narration apart', async () => {
    const book = await seedBook();

    await getOrCreateNarration(book, summary, 'short', 'Kore');
    await getOrCreateNarration(book, summary, 'long', 'Kore');

    expect(generateAudioSummary).toHaveBeenCalledTimes(2);
    await expect(blobs.get(book.id, 'audio-short')).resolves.toBeDefined();
    await expect(blobs.get(book.id, 'audio-long')).resolves.toBeDefined();
  });

  it('regenerates when the profile voice has changed', async () => {
    const book = await seedBook();

    await getOrCreateNarration(book, summary, 'short', 'Kore');
    await getOrCreateNarration(book, summary, 'short', 'Puck');

    // Serving Kore's recording to someone who has since chosen Puck would be a
    // silent wrong answer rather than a saved call.
    expect(generateAudioSummary).toHaveBeenCalledTimes(2);
  });

  it('does not regenerate for the same voice after a reload', async () => {
    const book = await seedBook();

    await getOrCreateNarration(book, summary, 'short', 'Puck');
    await getOrCreateNarration(book, summary, 'short', 'Puck');

    expect(generateAudioSummary).toHaveBeenCalledTimes(1);
  });

  it('caches per book', async () => {
    const first = await seedBook();
    const second = await books.create({ ...first, id: 'other', title: 'Deep Work' });

    await getOrCreateNarration(first, summary, 'short', 'Kore');
    await getOrCreateNarration(second, summary, 'short', 'Kore');

    expect(generateAudioSummary).toHaveBeenCalledTimes(2);
  });
});

describe('clearNarration', () => {
  it('drops both cached kinds so a new summary is narrated afresh', async () => {
    const book = await seedBook();
    await getOrCreateNarration(book, summary, 'short', 'Kore');
    await getOrCreateNarration(book, summary, 'long', 'Kore');

    await clearNarration(book.id);

    await expect(blobs.get(book.id, 'audio-short')).resolves.toBeUndefined();
    await expect(blobs.get(book.id, 'audio-long')).resolves.toBeUndefined();
  });
});
