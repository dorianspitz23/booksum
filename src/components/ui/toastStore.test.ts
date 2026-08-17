import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearToasts, dismissToast, getToasts, subscribeToToasts, toast } from './toastStore';
import { defined } from '../../test/defined';

beforeEach(() => {
  clearToasts();
});

describe('toastStore', () => {
  it('adds a toast and notifies subscribers', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToToasts(listener);

    toast.error('Something broke');

    expect(getToasts()).toHaveLength(1);
    expect(getToasts()[0]).toMatchObject({ kind: 'error', message: 'Something broke' });
    expect(listener).toHaveBeenCalled();
    unsubscribe();
  });

  it('gives each toast a distinct id', () => {
    toast.success('one');
    toast.success('two');
    const [a, b] = getToasts();
    expect(defined(a, 'first toast').id).not.toBe(defined(b, 'second toast').id);
  });

  it('dismisses by id', () => {
    toast.error('gone soon');
    dismissToast(defined(getToasts()[0], 'toast').id);
    expect(getToasts()).toHaveLength(0);
  });

  it('stops notifying after unsubscribe', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToToasts(listener);
    unsubscribe();
    toast.error('ignored');
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('the queue is bounded', () => {
  it('keeps the newest four and drops the oldest', () => {
    // Unbounded, the thing most likely to fill this queue is the thing it
    // exists to report: a failing bulk import raises one toast per item, so a
    // 300-book Goodreads import against a dead network stacked 300 of them and
    // buried the app behind a wall of identical messages.
    for (let i = 1; i <= 7; i += 1) toast.error(`failure ${i}`);

    expect(getToasts().map((t) => t.message)).toEqual([
      'failure 4',
      'failure 5',
      'failure 6',
      'failure 7',
    ]);
  });
});
