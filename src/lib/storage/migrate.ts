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
      const summaryId = crypto.randomUUID();
      const addedAt = legacy.addedAt ?? new Date().toISOString();

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
        hasPdf: Boolean(legacy.pdfData),
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

      if (legacy.pdfData) {
        const bytes = base64ToBytes(legacy.pdfData);
        await blobs.put(book.id, 'pdf', new Blob([bytes], { type: 'application/pdf' }));
        result.blobs += 1;
      }

      if (legacy.audioData) {
        const bytes = base64ToBytes(legacy.audioData);
        await blobs.put(book.id, 'audio-short', new Blob([bytes], { type: 'audio/wav' }));
        result.blobs += 1;
      }
    }
  }

  localStorage.setItem(MIGRATION_MARKER, new Date().toISOString());
  return result;
}
