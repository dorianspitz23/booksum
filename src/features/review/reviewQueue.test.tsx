import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '../../lib/storage/db';
import { books as bookRepo, profiles, reviewCards } from '../../lib/storage/repo';
import { ACTIVE_PROFILE_KEY, ProfileProvider } from '../profile/ProfileContext';
import { ReviewQueueProvider, useReviewQueue } from './useReviewQueue';
import { newCard } from '../../lib/srs';
import type { Profile } from '../../types';

let api: ReturnType<typeof useReviewQueue>;

function Probe() {
  api = useReviewQueue();
  return <p data-testid="remaining">{api.isLoading ? 'loading' : String(api.remaining)}</p>;
}

async function seedCard(profile: Profile, question: string, dueAt?: string) {
  const card = newCard({
    profileId: profile.id,
    bookId: 'b1',
    question,
    options: ['a', 'b', 'c', 'd'],
    correctAnswerIndex: 0,
    explanation: 'because',
  });
  return reviewCards.upsert(dueAt ? { ...card, dueAt } : card);
}

async function renderQueue() {
  const profile = await profiles.create({ name: 'Dorian' });
  localStorage.setItem(ACTIVE_PROFILE_KEY, profile.id);
  return profile;
}

function mount() {
  render(
    <ProfileProvider>
      <ReviewQueueProvider>
        <Probe />
      </ReviewQueueProvider>
    </ProfileProvider>,
  );
}

beforeEach(async () => {
  await resetDb();
  localStorage.clear();
});

describe('useReviewQueue with unusable cards', () => {
  it('does not let a card with no options deadlock the session', async () => {
    const profile = await renderQueue();
    // The fixture for this state already existed in this file, used only to
    // check cascade deletion — the assertion for the bug it actually causes was
    // never written. A card with no options rendered a question with no buttons,
    // so it could not be graded, never left the head of the queue, and blocked
    // every card behind it for good.
    await reviewCards.upsert(
      newCard({
        profileId: profile.id,
        bookId: 'b1',
        question: 'Unanswerable',
        options: [],
        correctAnswerIndex: 0,
        explanation: '',
      }),
    );
    await seedCard(profile, 'Answerable');

    mount();

    await waitFor(() => expect(screen.getByTestId('remaining')).toHaveTextContent('1'));
    expect(api.current?.question).toBe('Answerable');
  });

  it('skips a card whose correct answer is out of range', async () => {
    const profile = await renderQueue();
    await reviewCards.upsert(
      newCard({
        profileId: profile.id,
        bookId: 'b1',
        question: 'Impossible',
        options: ['a', 'b'],
        correctAnswerIndex: 7,
        explanation: '',
      }),
    );

    mount();

    // Every answer scored wrong, whichever the user picked.
    await waitFor(() => expect(screen.getByTestId('remaining')).toHaveTextContent('0'));
  });

  it('surfaces a card whose dueAt is corrupt instead of hiding it forever', async () => {
    const profile = await renderQueue();
    const card = newCard({
      profileId: profile.id,
      bookId: 'b1',
      question: 'Corrupt date',
      options: ['a', 'b', 'c', 'd'],
      correctAnswerIndex: 0,
      explanation: '',
    });
    // upsert normalising dueAt is the fix — an unnormalised value sorts past
    // every cutoff in the by-profile-due index and is unreachable through it.
    await reviewCards.upsert({ ...card, dueAt: 'not a date' });

    mount();

    await waitFor(() => expect(screen.getByTestId('remaining')).toHaveTextContent('1'));
  });
});

describe('useReviewQueue', () => {
  it('surfaces a due card', async () => {
    const profile = await renderQueue();
    await seedCard(profile, 'What is a habit stack?');

    mount();

    await waitFor(() => expect(screen.getByTestId('remaining')).toHaveTextContent('1'));
    expect(api.current?.question).toBe('What is a habit stack?');
  });

  it('ignores cards that are not due yet', async () => {
    const profile = await renderQueue();
    await seedCard(profile, 'Later', '2099-01-01T00:00:00.000Z');

    mount();

    await waitFor(() => expect(screen.getByTestId('remaining')).toHaveTextContent('0'));
  });

  it('ignores another profile cards', async () => {
    const mine = await renderQueue();
    const other = await profiles.create({ name: 'Someone else' });
    await seedCard(other, 'Not mine');
    await seedCard(mine, 'Mine');

    mount();

    await waitFor(() => expect(screen.getByTestId('remaining')).toHaveTextContent('1'));
    expect(api.current?.question).toBe('Mine');
  });

  it('removes a card from the queue when graded good and pushes it into the future', async () => {
    const profile = await renderQueue();
    const seeded = await seedCard(profile, 'Q1');

    mount();
    await waitFor(() => expect(screen.getByTestId('remaining')).toHaveTextContent('1'));

    await act(async () => {
      await api.grade(3);
    });

    await waitFor(() => expect(screen.getByTestId('remaining')).toHaveTextContent('0'));

    const [stored] = await reviewCards.listByProfile(profile.id);
    expect(stored?.id).toBe(seeded.id);
    expect(Date.parse(stored.dueAt)).toBeGreaterThan(Date.now());
    expect(stored?.reviewCount).toBe(1);
  });

  it('reschedules a failed card for tomorrow rather than repeating it now', async () => {
    const profile = await renderQueue();
    await seedCard(profile, 'Q1');

    mount();
    await waitFor(() => expect(screen.getByTestId('remaining')).toHaveTextContent('1'));

    await act(async () => {
      await api.grade(1);
    });

    const [stored] = await reviewCards.listByProfile(profile.id);
    expect(stored?.intervalDays).toBe(1);
    expect(Date.parse(stored.dueAt)).toBeGreaterThan(Date.now());
  });

  it('works through several cards in order', async () => {
    const profile = await renderQueue();
    await seedCard(profile, 'First', '2026-01-01T00:00:00.000Z');
    await seedCard(profile, 'Second', '2026-02-01T00:00:00.000Z');

    mount();
    await waitFor(() => expect(screen.getByTestId('remaining')).toHaveTextContent('2'));
    expect(api.current?.question).toBe('First');

    await act(async () => {
      await api.grade(3);
    });

    await waitFor(() => expect(api.current?.question).toBe('Second'));
  });

  it('drops a book cards when the book is deleted', async () => {
    const profile = await renderQueue();
    const book = await bookRepo.create({
      profileId: profile.id,
      title: 'Atomic Habits',
      author: 'James Clear',
      category: 'Productivity',
      status: 'Finished',
      rating: 5,
      readingTimeMinutes: 12,
      coverImageUrl: '',
      hasPdf: false,
    });
    await reviewCards.upsert(
      newCard({
        profileId: profile.id,
        bookId: book.id,
        question: 'Goes away',
        options: [],
        correctAnswerIndex: 0,
        explanation: '',
      }),
    );

    await bookRepo.remove(book.id);

    await expect(reviewCards.listByProfile(profile.id)).resolves.toHaveLength(0);
  });
});
