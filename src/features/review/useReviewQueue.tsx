import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { reviewCards as cardRepo } from '../../lib/storage/repo';
import { scheduleCard } from '../../lib/srs';
import type { Grade } from '../../lib/srs';
import { useProfile } from '../profile/ProfileContext';
import { toast } from '../../components/ui/toastStore';
import type { ReviewCard } from '../../types';

function useReviewQueueState() {
  const { profile, isLoading: profileLoading } = useProfile();
  const [queue, setQueue] = useState<ReviewCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGrading, setIsGrading] = useState(false);
  const gradingRef = useRef(false);

  const reload = useCallback(async () => {
    if (profileLoading) return;
    if (!profile) {
      setQueue([]);
      setIsLoading(false);
      return;
    }
    try {
      setQueue(await cardRepo.listDue(profile.id));
    } catch (error) {
      // Without this the rejection skipped setIsLoading(false) entirely and the
      // page sat on its spinner forever, with no message and no way to retry.
      console.error('[booksum] could not load the review queue', error);
      toast.error('Could not load your review cards.');
      setQueue([]);
    } finally {
      setIsLoading(false);
    }
  }, [profile, profileLoading]);

  useEffect(() => {
    void reload();
  }, [reload]);

  /**
   * Records a grade and drops the card from today's queue. A failed card is
   * rescheduled for tomorrow rather than repeated immediately, so one stubborn
   * question cannot block the rest of the session.
   *
   * The ref guard matters: grade() closes over `queue`, so two clicks landing
   * before the re-render both resolved queue[0] to the same card, graded it
   * twice, and sliced twice — silently dropping the next card ungraded.
   */
  const grade = useCallback(
    async (gradeValue: Grade) => {
      if (gradingRef.current) return;

      const [current] = queue;
      if (!current) return;

      gradingRef.current = true;
      setIsGrading(true);
      try {
        await cardRepo.upsert(scheduleCard(current, gradeValue));
        setQueue((rest) => rest.filter((card) => card.id !== current.id));
      } catch (error) {
        console.error('[booksum] could not save that review', error);
        toast.error('Could not save that review. Try again.');
      } finally {
        gradingRef.current = false;
        setIsGrading(false);
      }
    },
    [queue],
  );

  return {
    queue,
    current: queue[0],
    remaining: queue.length,
    isLoading,
    isGrading,
    grade,
    reload,
  };
}

export type ReviewQueueApi = ReturnType<typeof useReviewQueueState>;

const ReviewQueueContext = createContext<ReviewQueueApi | undefined>(undefined);

/**
 * One queue for the whole app. The nav badge and the review page must agree on
 * what is due, and two independent instances would drift the moment a card was
 * graded.
 */
export function ReviewQueueProvider({ children }: { children: ReactNode }) {
  const value = useReviewQueueState();
  return <ReviewQueueContext.Provider value={value}>{children}</ReviewQueueContext.Provider>;
}

export function useReviewQueue(): ReviewQueueApi {
  const context = useContext(ReviewQueueContext);
  if (!context) throw new Error('useReviewQueue must be used within a ReviewQueueProvider');
  return context;
}
