import type { QuizQuestion } from '../../types';

/**
 * The last line of defence between a model response and IndexedDB.
 *
 * `QUIZ_SCHEMA` now declares the bounds it used to state only in prose, which
 * makes a malformed response much less likely — but a schema is a request, not a
 * guarantee. Everything downstream treats a `ReviewCard` as trustworthy for the
 * rest of its life, and cards are persisted forever, so a single bad response
 * used to be permanent: an empty `options` array deadlocked the review queue
 * with no way past it, and an out-of-range `correctAnswerIndex` scored every
 * answer wrong while looking completely normal.
 *
 * Dropping a bad question costs the user one question. Persisting it costs them
 * the feature.
 */

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

function toQuizQuestion(value: unknown): QuizQuestion | null {
  if (!isRecord(value)) return null;

  const { question, options, correctAnswerIndex, explanation } = value;

  if (!isNonEmptyString(question)) return null;

  // Two options is the minimum that can pose a choice at all.
  if (!Array.isArray(options) || options.length < 2) return null;
  if (!options.every(isNonEmptyString)) return null;

  if (typeof correctAnswerIndex !== 'number') return null;
  if (!Number.isInteger(correctAnswerIndex)) return null;
  if (correctAnswerIndex < 0 || correctAnswerIndex >= options.length) return null;

  return {
    question: question.trim(),
    options: options.map((option) => option.trim()),
    correctAnswerIndex,
    explanation: isNonEmptyString(explanation)
      ? explanation.trim()
      : 'No explanation was provided.',
  };
}

/** Parses a quiz response into questions that are safe to persist. */
export function toQuizQuestions(response: unknown): QuizQuestion[] {
  if (!isRecord(response) || !Array.isArray(response.questions)) return [];

  const seen = new Set<string>();
  const questions: QuizQuestion[] = [];

  for (const candidate of response.questions) {
    const question = toQuizQuestion(candidate);
    if (!question) continue;

    // Question text is used as the dedup key when creating review cards and as a
    // React key when rendering, so duplicates would collide in both places.
    const key = question.question.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    questions.push(question);
  }

  return questions;
}
