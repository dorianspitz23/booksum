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

export function isDue(card: ReviewCard, now: Date = new Date()): boolean {
  return Date.parse(card.dueAt) <= now.getTime();
}
