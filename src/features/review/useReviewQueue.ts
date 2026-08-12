import { useCallback, useEffect, useState } from 'react';
import { reviewCards as cardRepo } from '../../lib/storage/repo';
import { scheduleCard } from '../../lib/srs';
import type { Grade } from '../../lib/srs';
import { useProfile } from '../profile/ProfileContext';
import type { ReviewCard } from '../../types';

export function useReviewQueue() {
  const { profile, isLoading: profileLoading } = useProfile();
  const [queue, setQueue] = useState<ReviewCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const reload = useCallback(async () => {
    if (profileLoading) return;
    if (!profile) {
      setQueue([]);
      setIsLoading(false);
      return;
    }
    setQueue(await cardRepo.listDue(profile.id));
    setIsLoading(false);
  }, [profile, profileLoading]);

  useEffect(() => {
    void reload();
  }, [reload]);

  /**
   * Records a grade and drops the card from today's queue. A failed card is
   * rescheduled for tomorrow rather than repeated immediately, so one stubborn
   * question cannot block the rest of the session.
   */
  const grade = useCallback(
    async (gradeValue: Grade) => {
      const [current] = queue;
      if (!current) return;

      await cardRepo.upsert(scheduleCard(current, gradeValue));
      setQueue((rest) => rest.slice(1));
    },
    [queue],
  );

  return {
    queue,
    current: queue[0],
    remaining: queue.length,
    isLoading,
    grade,
    reload,
  };
}
