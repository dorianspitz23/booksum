import type {
  Book,
  BookStatus,
  LibraryExport,
  Priority,
  Profile,
  ProfileSettings,
  ReviewCard,
  Summary,
  VoiceName,
} from '../../types';

/**
 * Runtime validation for the one boundary where a user-chosen file becomes the
 * app's most privileged type. Everything downstream -- `importLibrary`, then
 * `books.create` -- trusts its static parameter type, so this is the only place
 * that can tell the truth about what is actually in the file.
 *
 * Two jobs, and the second matters as much as the first:
 *   1. Reject anything that is not a well-formed v2 export.
 *   2. Rebuild each record field by field, so keys the type does not declare
 *      cannot ride along into IndexedDB. The original app exported `pdfData`
 *      and `audioData` inline on every book; spreading one of those into
 *      `books.create` is precisely the "no binary data in records" failure that
 *      broke it.
 */

export type ParseResult =
  { ok: true; data: LibraryExport; skipped: number } | { ok: false; reason: string };

const EXPORT_VERSION = 3;

/**
 * v2 files are still accepted. They carry books and summaries only, so they
 * import with no profile settings and no review cards — which is exactly what
 * they contained, and better than refusing a backup someone already made.
 */
const SUPPORTED_VERSIONS = [2, 3];

const VOICES: VoiceName[] = ['Kore', 'Puck', 'Zephyr', 'Charon', 'Fenrir'];
const THEMES: Profile['theme'][] = ['system', 'light', 'dark'];

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const str = (v: unknown): v is string => typeof v === 'string';
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const strArray = (v: unknown): v is string[] => Array.isArray(v) && v.every(str);

const STATUSES: BookStatus[] = ['Finished', 'Want to Read'];
const PRIORITIES: Priority[] = ['Low', 'Medium', 'High'];

/** Rebuilds a Book from unknown input, or returns null if it is not one. */
function toBook(value: unknown): Book | null {
  if (!isRecord(value)) return null;

  const { id, profileId, title, author, category, status, rating, coverImageUrl, addedAt } = value;

  if (!str(id) || !str(profileId) || !str(title) || !str(author)) return null;
  if (!str(category) || !str(coverImageUrl) || !str(addedAt)) return null;
  if (!num(rating)) return null;
  if (!str(status) || !STATUSES.includes(status as BookStatus)) return null;

  const book: Book = {
    id,
    profileId,
    title,
    author,
    category,
    status: status as BookStatus,
    rating,
    coverImageUrl,
    addedAt,
    readingTimeMinutes: num(value.readingTimeMinutes) ? value.readingTimeMinutes : 0,
    hasPdf: value.hasPdf === true,
  };

  // Optionals are copied only when they are the declared type, so a wrong-typed
  // field becomes an absent one rather than a lie the compiler believes.
  if (str(value.priority) && PRIORITIES.includes(value.priority as Priority)) {
    book.priority = value.priority as Priority;
  }
  if (str(value.personalNotes)) book.personalNotes = value.personalNotes;
  if (str(value.finishedAt)) book.finishedAt = value.finishedAt;
  if (str(value.oneSentenceTakeaway)) book.oneSentenceTakeaway = value.oneSentenceTakeaway;
  if (str(value.summaryId)) book.summaryId = value.summaryId;

  return book;
}

/** Rebuilds a Summary from unknown input, or returns null if it is not one. */
function toSummary(value: unknown): Summary | null {
  if (!isRecord(value)) return null;

  const { id, bookId, oneSentenceTakeaway, summary, keyInsights, actionableSteps, generatedAt } =
    value;

  if (!str(id) || !str(bookId) || !str(oneSentenceTakeaway) || !str(summary)) return null;
  if (!strArray(keyInsights) || !strArray(actionableSteps)) return null;
  if (!str(generatedAt)) return null;

  const result: Summary = {
    id,
    bookId,
    oneSentenceTakeaway,
    summary,
    keyInsights,
    actionableSteps,
    generatedAt,
    model: str(value.model) ? value.model : 'unknown',
  };
  if (str(value.detailedSummary)) result.detailedSummary = value.detailedSummary;

  return result;
}

/** Rebuilds a ReviewCard from unknown input, or returns null if it is not one. */
function toReviewCard(value: unknown): ReviewCard | null {
  if (!isRecord(value)) return null;

  const { id, profileId, bookId, question, options, correctAnswerIndex, explanation } = value;

  if (!str(id) || !str(profileId) || !str(bookId) || !str(question)) return null;
  if (!str(explanation) || !strArray(options)) return null;

  // Rejected here rather than repaired: a card whose correct answer is outside
  // its options scores every attempt wrong, and one with fewer than two options
  // cannot be answered at all. Both used to be importable and permanent.
  if (!num(correctAnswerIndex) || !Number.isInteger(correctAnswerIndex)) return null;
  if (options.length < 2 || correctAnswerIndex < 0 || correctAnswerIndex >= options.length) {
    return null;
  }

  const dueAt = str(value.dueAt) && !Number.isNaN(Date.parse(value.dueAt)) ? value.dueAt : null;
  if (!dueAt) return null;

  return {
    id,
    profileId,
    bookId,
    question,
    options,
    correctAnswerIndex,
    explanation,
    ease: num(value.ease) ? value.ease : 2.5,
    intervalDays: num(value.intervalDays) ? Math.max(1, Math.round(value.intervalDays)) : 1,
    dueAt,
    reviewCount: num(value.reviewCount) ? Math.max(0, Math.round(value.reviewCount)) : 0,
  };
}

/** Rebuilds the restorable profile settings, or returns null if absent/malformed. */
function toProfileSettings(value: unknown): ProfileSettings | null {
  if (!isRecord(value)) return null;
  if (!str(value.name) || !value.name.trim()) return null;

  return {
    name: value.name,
    bio: str(value.bio) ? value.bio : '',
    monthlyGoal: num(value.monthlyGoal) ? Math.max(0, Math.round(value.monthlyGoal)) : 4,
    favoriteVoice:
      str(value.favoriteVoice) && VOICES.includes(value.favoriteVoice as VoiceName)
        ? (value.favoriteVoice as VoiceName)
        : 'Kore',
    theme:
      str(value.theme) && THEMES.includes(value.theme as Profile['theme'])
        ? (value.theme as Profile['theme'])
        : 'system',
  };
}

export function parseLibraryExport(value: unknown): ParseResult {
  if (!isRecord(value)) {
    return { ok: false, reason: 'That file is not a BookSum backup.' };
  }
  if (typeof value.version !== 'number' || !SUPPORTED_VERSIONS.includes(value.version)) {
    return {
      ok: false,
      reason: `That backup is version ${num(value.version) || str(value.version) ? String(value.version) : 'unknown'}, and this version of BookSum can import ${SUPPORTED_VERSIONS.join(' and ')}.`,
    };
  }
  if (!Array.isArray(value.books)) {
    return { ok: false, reason: 'That backup has no list of books.' };
  }

  const rawSummaries = Array.isArray(value.summaries) ? value.summaries : [];

  const books: Book[] = [];
  const summaries: Summary[] = [];
  let skipped = 0;

  for (const candidate of value.books) {
    const book = toBook(candidate);
    if (book) books.push(book);
    else skipped += 1;
  }
  for (const candidate of rawSummaries) {
    const summary = toSummary(candidate);
    if (summary) summaries.push(summary);
    else skipped += 1;
  }

  const reviewCards: ReviewCard[] = [];
  for (const candidate of Array.isArray(value.reviewCards) ? value.reviewCards : []) {
    const card = toReviewCard(candidate);
    if (card) reviewCards.push(card);
    else skipped += 1;
  }

  const data: LibraryExport = {
    version: EXPORT_VERSION,
    exportedAt: str(value.exportedAt) ? value.exportedAt : new Date().toISOString(),
    books,
    summaries,
    reviewCards,
  };

  // Absent in every v2 file, so a missing profile is normal rather than an error.
  const profile = toProfileSettings(value.profile);
  if (profile) data.profile = profile;

  return { ok: true, skipped, data };
}
