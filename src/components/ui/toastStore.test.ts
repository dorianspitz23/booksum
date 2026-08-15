import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearToasts, dismissToast, getToasts, subscribeToToasts, toast } from './toastStore';

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
    expect(a.id).not.toBe(b.id);
  });

  it('dismisses by id', () => {
    toast.error('gone soon');
    dismissToast(getToasts()[0].id);
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
