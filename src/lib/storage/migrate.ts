import { tryBase64ToBytes } from '../base64';
import { newId } from '../id';
import { blobs, books, profiles, summaries } from './repo';
import { VOICE_NAMES } from '../../types';
import type { Priority, VoiceName } from '../../types';

export { MIGRATION_MARKER } from '../storageKeys';
import { MIGRATION_MARKER, LEGACY_LIBRARY_PREFIX, legacyProfileKey } from '../storageKeys';

const LIBRARY_KEY_PREFIX = LEGACY_LIBRARY_PREFIX;

export interface MigrationResult {
  migrated: boolean;
  profiles: number;
  books: number;
  summaries: number;
  blobs: number;
  /** Legacy records that could not be read and were skipped. */
  failed: number;
}

/**
 * Unknown-valued for the same reason as `LegacyProfile` below: this is JSON from
 * a build that no longer exists, and naming a field `keyInsights?: string[]`
 * here told the compiler an array of strings was guaranteed when the stored
 * value could be a string, a number, or null. Every read below goes through a
 * checking helper, so the declaration says what is actually known — the key may
 * be there, and nothing more.
 */
interface LegacyBook {
  id?: unknown;
  title?: unknown;
  author?: unknown;
  category?: unknown;
  oneSentenceTakeaway?: unknown;
  summary?: unknown;
  keyInsights?: unknown;
  actionableSteps?: unknown;
  detailedSummary?: unknown;
  personalNotes?: unknown;
  coverImageUrl?: unknown;
  rating?: unknown;
  priority?: unknown;
  readingTimeMinutes?: unknown;
  addedAt?: unknown;
  status?: unknown;
  audioData?: unknown;
  pdfData?: unknown;
}

/**
 * Every field is `unknown` on purpose. This shape describes JSON written by a
 * build of the app that no longer exists, so declaring `favoriteVoice?:
 * VoiceName` here was a claim about someone else's data: a stored
 * `favoriteVoice: "Bob"` satisfied the compiler and was then persisted into a
 * `Profile` that says it is one of five voices. Every narration request after
 * that failed with an error about the API rather than about the voice, and the
 * voice picker showed nothing selected with no way to tell why.
 */
interface LegacyProfile {
  name?: unknown;
  monthlyGoal?: unknown;
  joinedAt?: unknown;
  bio?: unknown;
  favoriteVoice?: unknown;
}

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

const asPositiveInt = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.round(value) : undefined;

const asVoice = (value: unknown): VoiceName | undefined =>
  VOICE_NAMES.find((voice) => voice === value);

const EMPTY: MigrationResult = {
  migrated: false,
  profiles: 0,
  books: 0,
  summaries: 0,
  blobs: 0,
  failed: 0,
};

const PRIORITIES: Priority[] = ['Low', 'Medium', 'High'];

/**
 * Legacy records were written by a different version of this app and have been
 * sitting in localStorage ever since. Nothing guarantees their shape, so each
 * field is checked for the type it is supposed to be rather than merely for
 * being non-nullish — `??` would let a number through where a string belongs and
 * then hand the compiler a `Book` it wrongly believes.
 */
const str = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value : undefined;

const num = (value: unknown, min: number, max: number): number | undefined =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : undefined;

/**
 * The original app built cover URLs by string interpolation without checking
 * for a missing value, so records carry the literal text 'null' (and sometimes
 * 'undefined') where a URL belongs. `<img src="null">` requests the page's own
 * directory, which resolves, so the browser shows a broken-image icon rather
 * than firing onError. Normalising here means a migration performed today
 * yields clean records instead of pushing the workaround into every renderer.
 */
const normaliseCoverUrl = (value: string | undefined): string =>
  !value || value === 'null' || value === 'undefined' ? '' : value;

const strArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

/** Returns parsed JSON as `unknown` — the caller is responsible for checking it. */
function readJson(key: string): unknown {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

/**
 * Legacy attachments are base64 written by the original app. `atob` throws on
 * anything outside the alphabet, so this returns null rather than propagating
 * and taking the whole migration down with it. The guard now lives in
 * `tryBase64ToBytes`, since every caller was hand-rolling this same wrapper.
 */
/**
 * Takes `unknown` because that is what a legacy record's attachment field
 * actually is. Anything that is not a string is "no attachment", which is the
 * same outcome as a string that will not decode.
 */
const decodeAttachment = (value: unknown) => tryBase64ToBytes(str(value));

function legacyUserIds(): string[] {
  const ids: string[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key?.startsWith(LIBRARY_KEY_PREFIX)) {
      ids.push(key.slice(LIBRARY_KEY_PREFIX.length));
    }
  }
  return ids;
}

/**
 * One-time, non-destructive import of pre-IndexedDB data.
 * Legacy localStorage keys are left untouched; a marker prevents re-running.
 * Passwords in `booksum_db_users` are never read.
 */
export async function migrateLegacyData(): Promise<MigrationResult> {
  if (localStorage.getItem(MIGRATION_MARKER)) return EMPTY;

  const userIds = legacyUserIds();
  if (userIds.length === 0) return EMPTY;

  const result: MigrationResult = { ...EMPTY, migrated: true };

  for (const userId of userIds) {
    try {
      const rawProfile = readJson(legacyProfileKey(userId));
      // An asserted generic told the compiler this was a LegacyProfile no matter
      // what came back -- including a string, an array, or null -- and every
      // field read off it downstream inherited that lie.
      const legacyProfile: LegacyProfile =
        rawProfile !== null && typeof rawProfile === 'object' && !Array.isArray(rawProfile)
          ? rawProfile
          : {};
      const profile = await profiles.create({
        name: asString(legacyProfile.name)?.trim() || 'Reader',
        bio: asString(legacyProfile.bio),
        monthlyGoal: asPositiveInt(legacyProfile.monthlyGoal),
        favoriteVoice: asVoice(legacyProfile.favoriteVoice),
        createdAt: asString(legacyProfile.joinedAt),
      });
      result.profiles += 1;

      // Same reason: a library key holding an object rather than an array used to
      // be handed to `for...of` as a typed array and threw a TypeError that took
      // the whole migration with it.
      const rawBooks = readJson(`${LIBRARY_KEY_PREFIX}${userId}`);
      const legacyBooks: LegacyBook[] = Array.isArray(rawBooks)
        ? rawBooks.filter(
            (entry): entry is LegacyBook => entry !== null && typeof entry === 'object',
          )
        : [];

      for (const legacy of legacyBooks) {
        // One unreadable record must not abort the run. base64ToBytes throws on
        // any attachment that is not valid base64, and this data has been sitting
        // in localStorage since the original app wrote it.
        try {
          const addedAt = str(legacy.addedAt) ?? new Date().toISOString();

          // A legacy book only gets a summary if it actually had one. Every book
          // used to be given a summaryId and a Summary row made of empty
          // strings, so a "Want to Read" entry that had never been summarised
          // came out looking summarised to any check keyed on summaryId, and
          // unsummarised to any check keyed on the takeaway.
          const takeaway = str(legacy.oneSentenceTakeaway);
          const body = str(legacy.summary);
          const hasSummary = Boolean(takeaway || body);
          const summaryId = hasSummary ? newId() : undefined;

          // Decoded before the book is written so a corrupt attachment costs the
          // user the attachment, not the book -- and so hasPdf describes what was
          // actually stored rather than what the legacy record claimed.
          const pdfBytes = decodeAttachment(legacy.pdfData);
          const audioBytes = decodeAttachment(legacy.audioData);
          if (legacy.pdfData && !pdfBytes) result.failed += 1;
          if (legacy.audioData && !audioBytes) result.failed += 1;

          // `??` guards nullish only, so a legacy record holding a number where a
          // string belonged (or the reverse) was written straight through as a
          // typed Book that the compiler then trusted everywhere downstream.
          const status = legacy.status === 'Finished' ? 'Finished' : 'Want to Read';

          const book = await books.create({
            profileId: profile.id,
            title: str(legacy.title) ?? 'Untitled',
            author: str(legacy.author) ?? 'Unknown',
            category: str(legacy.category) ?? 'Other',
            status,
            priority: PRIORITIES.find((value) => value === legacy.priority),
            rating: num(legacy.rating, 0, 5) ?? 0,
            personalNotes: str(legacy.personalNotes),
            // The original app stringified a missing cover, so records carry the
            // literal text 'null' as a URL. Normalising it here means a fresh
            // migration produces clean data; `BookCover` still guards the render
            // path for libraries migrated before this existed.
            coverImageUrl: normaliseCoverUrl(str(legacy.coverImageUrl)),
            readingTimeMinutes: num(legacy.readingTimeMinutes, 0, 100_000) ?? 5,
            addedAt,
            // The legacy app never recorded a completion date, so a migrated
            // "Finished" book arrived with no `finishedAt` and was invisible to
            // the Monthly Goal ring — someone with a full migrated library saw
            // 0 of 8 and no way to fix it short of re-marking every book. The
            // added date is the only evidence available and it is at least a
            // date the book was in the library, so it is used as a stand-in and
            // the goal counts what it can.
            finishedAt: status === 'Finished' ? addedAt : undefined,
            // Denormalised onto Book so list views render without loading the
            // summary. Leaving it unset was why every migrated book showed
            // "Not summarised yet" despite carrying a summaryId.
            oneSentenceTakeaway: takeaway,
            summaryId,
            hasPdf: pdfBytes !== null,
          });
          result.books += 1;

          if (summaryId) {
            await summaries.upsert({
              id: summaryId,
              bookId: book.id,
              oneSentenceTakeaway: takeaway ?? '',
              summary: body ?? '',
              keyInsights: strArray(legacy.keyInsights),
              actionableSteps: strArray(legacy.actionableSteps),
              detailedSummary: str(legacy.detailedSummary),
              generatedAt: addedAt,
              model: 'legacy',
            });
            result.summaries += 1;
          }

          if (pdfBytes) {
            await blobs.put(book.id, 'pdf', new Blob([pdfBytes], { type: 'application/pdf' }));
            result.blobs += 1;
          }

          if (audioBytes) {
            await blobs.put(book.id, 'audio-short', new Blob([audioBytes], { type: 'audio/wav' }));
            result.blobs += 1;
          }
        } catch (error) {
          console.warn('Skipped an unreadable legacy book during migration', error);
          result.failed += 1;
        }
      }
    } catch (error) {
      console.warn('Skipped an unreadable legacy profile during migration', error);
      result.failed += 1;
    }
  }

  // Written on every completed run, including one that skipped records. The
  // marker used to be written only after a fully clean pass, so a single bad
  // record left it unwritten and the next reload re-imported everything that
  // had already been written -- duplicating the library on every boot.
  localStorage.setItem(MIGRATION_MARKER, new Date().toISOString());
  return result;
}
