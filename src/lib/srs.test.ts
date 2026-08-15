/**
 * @vitest-environment node
 *
 * No DOM here, so this suite skips the jsdom window the default environment
 * builds. See src/test/setup.ts.
 */
import { describe, expect, it } from 'vitest';
import { isAnswerable, isDue, newCard, scheduleCard } from './srs';
import type { ReviewCard } from '../types';

const NOW = new Date('2026-08-12T00:00:00.000Z');

function card(overrides: Partial<ReviewCard> = {}): ReviewCard {
  return {
    ...newCard(
      {
        profileId: 'p1',
        bookId: 'b1',
        question: 'Q',
        options: ['a', 'b', 'c', 'd'],
        correctAnswerIndex: 0,
        explanation: 'because',
      },
      NOW,
    ),
    ...overrides,
  };
}

describe('newCard', () => {
  it('starts due immediately with a one-day interval', () => {
    const created = card();
    expect(created.intervalDays).toBe(1);
    expect(created.reviewCount).toBe(0);
    expect(created.ease).toBeCloseTo(2.5);
    expect(isDue(created, NOW)).toBe(true);
  });

  it('carries the question through', () => {
    expect(card()).toMatchObject({ question: 'Q', correctAnswerIndex: 0, bookId: 'b1' });
  });
});

describe('scheduleCard', () => {
  it('resets the interval on a failed recall', () => {
    const next = scheduleCard(card({ intervalDays: 10, ease: 2.5 }), 1, NOW);
    expect(next.intervalDays).toBe(1);
    expect(next.ease).toBeLessThan(2.5);
  });

  it('never lets ease fall below 1.3', () => {
    let current = card({ ease: 1.4 });
    for (let i = 0; i < 10; i += 1) current = scheduleCard(current, 1, NOW);
    expect(current.ease).toBeGreaterThanOrEqual(1.3);
  });

  it('grows the interval on repeated good recalls', () => {
    const first = scheduleCard(card(), 3, NOW);
    const second = scheduleCard(first, 3, NOW);
    expect(second.intervalDays).toBeGreaterThan(first.intervalDays);
  });

  it('grows faster for easy than for good', () => {
    const good = scheduleCard(card({ intervalDays: 10 }), 3, NOW);
    const easy = scheduleCard(card({ intervalDays: 10 }), 4, NOW);
    expect(easy.intervalDays).toBeGreaterThan(good.intervalDays);
  });

  it('grows more slowly for hard than for good', () => {
    const hard = scheduleCard(card({ intervalDays: 10 }), 2, NOW);
    const good = scheduleCard(card({ intervalDays: 10 }), 3, NOW);
    expect(hard.intervalDays).toBeLessThan(good.intervalDays);
  });

  it('raises ease only for easy', () => {
    expect(scheduleCard(card(), 4, NOW).ease).toBeGreaterThan(2.5);
    expect(scheduleCard(card(), 3, NOW).ease).toBeCloseTo(2.5);
    expect(scheduleCard(card(), 2, NOW).ease).toBeLessThan(2.5);
  });

  it('never schedules less than a day out', () => {
    const next = scheduleCard(card({ intervalDays: 1, ease: 1.3 }), 2, NOW);
    expect(next.intervalDays).toBeGreaterThanOrEqual(1);
  });

  it('sets dueAt to now plus the new interval', () => {
    const next = scheduleCard(card({ intervalDays: 1 }), 3, NOW);
    expect(Date.parse(next.dueAt)).toBe(NOW.getTime() + next.intervalDays * 24 * 60 * 60 * 1000);
  });

  it('counts each review', () => {
    expect(scheduleCard(card(), 3, NOW).reviewCount).toBe(1);
    expect(scheduleCard(scheduleCard(card(), 3, NOW), 3, NOW).reviewCount).toBe(2);
  });

  it('leaves a failed card due again today', () => {
    const failed = scheduleCard(card({ intervalDays: 30 }), 1, NOW);
    expect(isDue(failed, NOW)).toBe(false);
    expect(isDue(failed, new Date(NOW.getTime() + 24 * 60 * 60 * 1000))).toBe(true);
  });
});

describe('isDue', () => {
  it('is false before the due date', () => {
    expect(isDue(card({ dueAt: '2026-09-01T00:00:00.000Z' }), NOW)).toBe(false);
  });

  it('is true on the due date', () => {
    expect(isDue(card({ dueAt: NOW.toISOString() }), NOW)).toBe(true);
  });

  it('is true after the due date', () => {
    expect(isDue(card({ dueAt: '2026-01-01T00:00:00.000Z' }), NOW)).toBe(true);
  });

  it('treats an unparseable dueAt as due rather than hiding the card forever', () => {
    // `NaN <= n` is false, so this used to return false — and the by-profile-due
    // index excluded the card too, because a non-ISO string sorts past every real
    // cutoff. The card existed and was unreachable in both directions at once.
    expect(isDue(card({ dueAt: 'not a date' }), NOW)).toBe(true);
    expect(isDue(card({ dueAt: '' }), NOW)).toBe(true);
  });
});

describe('isAnswerable', () => {
  it('accepts a well-formed card', () => {
    expect(isAnswerable(card({ options: ['a', 'b', 'c', 'd'], correctAnswerIndex: 2 }))).toBe(true);
  });

  it('rejects a card with no options', () => {
    // This exact shape deadlocked the review session: the page rendered a
    // question with no buttons, so the card could never be graded and never
    // left the head of the queue.
    expect(isAnswerable(card({ options: [], correctAnswerIndex: 0 }))).toBe(false);
  });

  it('rejects a single-option card, which cannot test anything', () => {
    expect(isAnswerable(card({ options: ['only'], correctAnswerIndex: 0 }))).toBe(false);
  });

  it('rejects an out-of-range correct answer', () => {
    // Scored every answer wrong, whichever the user picked.
    expect(isAnswerable(card({ options: ['a', 'b'], correctAnswerIndex: 2 }))).toBe(false);
    expect(isAnswerable(card({ options: ['a', 'b'], correctAnswerIndex: -1 }))).toBe(false);
  });

  it('rejects a non-integer index, which can never equal a rendered index', () => {
    expect(isAnswerable(card({ options: ['a', 'b'], correctAnswerIndex: 1.5 }))).toBe(false);
  });
});
