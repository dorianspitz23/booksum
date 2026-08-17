export type BookStatus = 'Finished' | 'Want to Read';
export type Priority = 'Low' | 'Medium' | 'High';
/**
 * The union is derived from the list rather than written twice. `ProfileView`
 * kept its own `VOICES` array to render the picker, so adding a voice to the
 * type and forgetting the array — or the reverse — compiled cleanly and shipped
 * either a voice nobody could select or an option that failed at the API.
 */
export const VOICE_NAMES = ['Kore', 'Puck', 'Zephyr', 'Charon', 'Fenrir'] as const;
export type VoiceName = (typeof VOICE_NAMES)[number];
export type BlobKind = 'pdf' | 'audio-short' | 'audio-long';

/**
 * The categories the model is asked to choose from.
 *
 * This was an `enum Category` with zero references, while the same eight names
 * were written out again in the AI schema and a third time in the prompt prose.
 * Three copies of one list, none of them load-bearing — so a ninth category
 * added to the schema would have quietly disagreed with the other two.
 *
 * `Book.category` stays a plain `string`. It is populated by a model and by
 * Goodreads shelves, and a record that arrives with something not on this list
 * must still render rather than fail a type guard on read. This is the list we
 * *ask* for, not a promise about what is in the database.
 */
export const CATEGORIES = [
  'Psychology',
  'Productivity',
  'Business',
  'Technology',
  'Philosophy',
  'Health',
  'Biography',
  'Other',
] as const;

export type Category = (typeof CATEGORIES)[number];

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
  /**
   * Decided by `kind`, never copied from the incoming Blob — this value comes
   * back out on a `blob:` URL, which inherits this page's origin, so it decides
   * whether the browser treats the bytes as a document or as markup with our
   * privileges. See BLOB_MIME in the repo.
   */
  type: string;
  /**
   * Which voice generated an audio blob, so changing the profile's voice
   * invalidates the cached narration instead of replaying the old one.
   *
   * A field rather than a `;voice=Kore` parameter on `type`, which is where it
   * used to live: overloading the MIME meant the cache key and the value the
   * browser is told to render were the same string, so constraining one broke
   * the other. IndexedDB object stores are schemaless, so adding this needed no
   * version bump — records written before it simply have no voice, and are
   * regenerated once.
   */
  voice?: string;
}

/**
 * One multiple-choice question.
 *
 * The single definition. This shape was written out three times — here, on
 * `ReviewCard`, and again as `NewCardInput` in srs.ts — so adding a field
 * meant finding all three, and any one of them could drift into describing a
 * question the other two did not recognise.
 */
export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
}

/** Created in the v1 schema so Phase 3 needs no database version bump. */
export interface ReviewCard extends QuizQuestion {
  id: string;
  profileId: string;
  bookId: string;
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
