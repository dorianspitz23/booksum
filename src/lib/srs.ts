import { newId } from './id';
import type { ReviewCard } from '../types';

/** 1 = again, 2 = hard, 3 = good, 4 = easy. */
export type Grade = 1 | 2 | 3 | 4;

const DAY_MS = 24 * 60 * 60 * 1000;
const STARTING_EASE = 2.5;
const MIN_EASE = 1.3;

const EASE_DELTA: Record<Grade, number> = { 1: -0.2, 2: -0.15, 3: 0, 4: 0.1 };
const INTERVAL_MODIFIER: Record<Grade, number> = { 1: 0, 2: 0.6, 3: 1, 4: 1.3 };

export interface NewCardInput {
  profileId: string;
  bookId: string;
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
}

export function newCard(input: NewCardInput, now: Date = new Date()): ReviewCard {
  return {
    id: newId(),
    profileId: input.profileId,
    bookId: input.bookId,
    question: input.question,
    options: input.options,
    correctAnswerIndex: input.correctAnswerIndex,
    explanation: input.explanation,
    ease: STARTING_EASE,
    intervalDays: 1,
    dueAt: now.toISOString(),
    reviewCount: 0,
  };
}

/**
 * SM-2-lite. A failed recall resets the interval to one day and nudges ease
 * down; success multiplies the interval by ease and a per-grade modifier.
 */
export function scheduleCard(card: ReviewCard, grade: Grade, now: Date = new Date()): ReviewCard {
  const ease = Math.max(MIN_EASE, card.ease + EASE_DELTA[grade]);

  const intervalDays =
    grade === 1 ? 1 : Math.max(1, Math.round(card.intervalDays * ease * INTERVAL_MODIFIER[grade]));

  return {
    ...card,
    ease,
    intervalDays,
    dueAt: new Date(now.getTime() + intervalDays * DAY_MS).toISOString(),
    reviewCount: card.reviewCount + 1,
  };
}

/**
 * The single definition of "due". `reviewCards.listDue` is the indexed form of
 * this predicate: `by-profile-due` stores ISO-8601 strings, which sort in the
 * same order as the instants they name, so a key range up to `now` selects
 * exactly the cards this returns true for. Any change to one needs the other.
 */
export function isDue(card: ReviewCard, now: Date = new Date()): boolean {
  const due = Date.parse(card.dueAt);
  // `NaN <= n` is false, so a card whose dueAt could not be parsed used to be
  // invisible in both directions at once: this said "not due", and the index
  // range excluded it too because a non-ISO string sorts past any real cutoff.
  // Treating it as due surfaces the card, and grading rewrites dueAt — so the
  // card repairs itself instead of sitting in the database forever unreachable.
  return Number.isNaN(due) || due <= now.getTime();
}

/**
 * Whether a card can actually be answered.
 *
 * Cards are built from model output. One with an empty `options` array rendered
 * a question with no buttons — nothing to click, nothing to grade, and the card
 * stayed at the head of the queue, so the whole review session deadlocked. One
 * with `correctAnswerIndex` outside the options scored every answer wrong.
 *
 * Quiz responses are validated before they become cards now, so this guards
 * what is already persisted rather than what is arriving.
 */
export function isAnswerable(card: ReviewCard): boolean {
  return (
    Array.isArray(card.options) &&
    card.options.length >= 2 &&
    Number.isInteger(card.correctAnswerIndex) &&
    card.correctAnswerIndex >= 0 &&
    card.correctAnswerIndex < card.options.length
  );
}
