export type BookStatus = 'Finished' | 'Want to Read';
export type Priority = 'Low' | 'Medium' | 'High';
export type VoiceName = 'Kore' | 'Puck' | 'Zephyr' | 'Charon' | 'Fenrir';
export type BlobKind = 'pdf' | 'audio-short' | 'audio-long';

export enum Category {
  PSYCHOLOGY = 'Psychology',
  PRODUCTIVITY = 'Productivity',
  BUSINESS = 'Business',
  TECHNOLOGY = 'Technology',
  PHILOSOPHY = 'Philosophy',
  HEALTH = 'Health',
  BIOGRAPHY = 'Biography',
  OTHER = 'Other',
}

export interface Profile {
  id: string;
  name: string;
  bio: string;
  monthlyGoal: number;
  favoriteVoice: VoiceName;
  theme: 'system' | 'light' | 'dark';
  createdAt: string;
}

/** A book in the library. Carries no binary data and no summary text. */
export interface Book {
  id: string;
  profileId: string;
  title: string;
  author: string;
  category: string;
  status: BookStatus;
  priority?: Priority;
  rating: number;
  personalNotes?: string;
  coverImageUrl: string;
  addedAt: string;
  finishedAt?: string;
  /**
   * Two fields denormalised from Summary onto Book, for one reason: list views
   * (BookCard, StatsView) render them for every book on screen and must not
   * load every summary to do so. Both are written only when a summary is
   * generated, so Summary remains the source of truth for everything else.
   */
  readingTimeMinutes: number;
  oneSentenceTakeaway?: string;
  /** Absent until an AI summary has been generated for this book. */
  summaryId?: string;
  hasPdf: boolean;
  /**
   * Zero-based section the reader was last on. The reader already computed and
   * displayed "% Complete" but never stored it, so it always reopened at the
   * first section — the progress bar was showing a number that survived nothing.
   */
  lastReadSection?: number;
}

export interface Summary {
  id: string;
  bookId: string;
  oneSentenceTakeaway: string;
  summary: string;
  keyInsights: string[];
  actionableSteps: string[];
  detailedSummary?: string;
  generatedAt: string;
  /** Model ID that produced this, or 'legacy' for migrated records. */
  model: string;
}

export interface StoredBlob {
  /** `${bookId}:${kind}` */
  key: string;
  bookId: string;
  kind: BlobKind;
  /**
   * Raw bytes, not a Blob. Structured-clone support for Blob is inconsistent
   * across IndexedDB implementations (fake-indexeddb drops it entirely, and
   * older Safari had real bugs), while ArrayBuffer is universal. The repo
   * converts to and from Blob at its boundary so callers never see this.
   */
  bytes: ArrayBuffer;
  type: string;
}

/** Created in the v1 schema so Phase 3 needs no database version bump. */
export interface ReviewCard {
  id: string;
  profileId: string;
  bookId: string;
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
  ease: number;
  intervalDays: number;
  dueAt: string;
  reviewCount: number;
}

/** Profile fields a backup carries. Identity (`id`, `createdAt`) is not restored. */
export type ProfileSettings = Pick<
  Profile,
  'name' | 'bio' | 'monthlyGoal' | 'favoriteVoice' | 'theme'
>;

/**
 * Shape of a library backup file.
 *
 * v3 added `profile` and `reviewCards`. v2 carried books and summaries only, so
 * moving to a new device silently lost every setting and the whole
 * spaced-repetition schedule — the one dataset that costs real money to rebuild,
 * since cards can only come from an AI-generated quiz. v2 files still import;
 * both fields are optional for exactly that reason.
 */
export interface LibraryExport {
  version: 3;
  exportedAt: string;
  books: Book[];
  summaries: Summary[];
  profile?: ProfileSettings;
  reviewCards?: ReviewCard[];
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
}
