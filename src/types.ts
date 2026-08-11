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
   * Minutes to read this book's generated summary. Lives on Book, not Summary,
   * because BookCard and StatsView render it for every book in a list and must
   * not load every summary to do so.
   */
  readingTimeMinutes: number;
  /** Absent until an AI summary has been generated for this book. */
  summaryId?: string;
  hasPdf: boolean;
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

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
}
