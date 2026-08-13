import { base64ToBytes } from '../base64';
import { blobs, books, profiles, summaries } from './repo';
import type { BookStatus, Priority, VoiceName } from '../../types';

export const MIGRATION_MARKER = 'booksum.migratedAt';

const LIBRARY_KEY_PREFIX = 'booksum_library_';

export interface MigrationResult {
  migrated: boolean;
  profiles: number;
  books: number;
  summaries: number;
  blobs: number;
  /** Legacy records that could not be read and were skipped. */
  failed: number;
}

interface LegacyBook {
  id?: string;
  title?: string;
  author?: string;
  category?: string;
  oneSentenceTakeaway?: string;
  summary?: string;
  keyInsights?: string[];
  actionableSteps?: string[];
  detailedSummary?: string;
  personalNotes?: string;
  coverImageUrl?: string;
  rating?: number;
  priority?: Priority;
  readingTimeMinutes?: number;
  addedAt?: string;
  status?: BookStatus;
  audioData?: string;
  pdfData?: string;
}

interface LegacyProfile {
  name?: string;
  monthlyGoal?: number;
  joinedAt?: string;
  bio?: string;
  favoriteVoice?: VoiceName;
}

const EMPTY: MigrationResult = {
  migrated: false,
  profiles: 0,
  books: 0,
  summaries: 0,
  blobs: 0,
  failed: 0,
};

function readJson<T>(key: string): T | null {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Legacy attachments are base64 written by the original app. `atob` throws on
 * anything outside the alphabet, so this returns null rather than propagating
 * and taking the whole migration down with it.
 */
function decodeAttachment(base64: string | undefined): Uint8Array<ArrayBuffer> | null {
  if (!base64) return null;
  try {
    return base64ToBytes(base64);
  } catch {
    return null;
  }
}

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
      const legacyProfile = readJson<LegacyProfile>(`booksum_profile_${userId}`);
      const profile = await profiles.create({
        name: legacyProfile?.name?.trim() || 'Reader',
        bio: legacyProfile?.bio,
        monthlyGoal: legacyProfile?.monthlyGoal,
        favoriteVoice: legacyProfile?.favoriteVoice,
        createdAt: legacyProfile?.joinedAt,
      });
      result.profiles += 1;

      const legacyBooks = readJson<LegacyBook[]>(`${LIBRARY_KEY_PREFIX}${userId}`) ?? [];

      for (const legacy of legacyBooks) {
        // One unreadable record must not abort the run. base64ToBytes throws on
        // any attachment that is not valid base64, and this data has been sitting
        // in localStorage since the original app wrote it.
        try {
          const summaryId = crypto.randomUUID();
          const addedAt = legacy.addedAt ?? new Date().toISOString();

          // Decoded before the book is written so a corrupt attachment costs the
          // user the attachment, not the book -- and so hasPdf describes what was
          // actually stored rather than what the legacy record claimed.
          const pdfBytes = decodeAttachment(legacy.pdfData);
          const audioBytes = decodeAttachment(legacy.audioData);
          if (legacy.pdfData && !pdfBytes) result.failed += 1;
          if (legacy.audioData && !audioBytes) result.failed += 1;

          const book = await books.create({
            profileId: profile.id,
            title: legacy.title ?? 'Untitled',
            author: legacy.author ?? 'Unknown',
            category: legacy.category ?? 'Other',
            status: legacy.status ?? 'Want to Read',
            priority: legacy.priority,
            rating: legacy.rating ?? 0,
            personalNotes: legacy.personalNotes,
            coverImageUrl: legacy.coverImageUrl ?? '',
            readingTimeMinutes: legacy.readingTimeMinutes ?? 5,
            addedAt,
            summaryId,
            hasPdf: pdfBytes !== null,
          });
          result.books += 1;

          await summaries.upsert({
            id: summaryId,
            bookId: book.id,
            oneSentenceTakeaway: legacy.oneSentenceTakeaway ?? '',
            summary: legacy.summary ?? '',
            keyInsights: legacy.keyInsights ?? [],
            actionableSteps: legacy.actionableSteps ?? [],
            detailedSummary: legacy.detailedSummary,
            generatedAt: addedAt,
            model: 'legacy',
          });
          result.summaries += 1;

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
