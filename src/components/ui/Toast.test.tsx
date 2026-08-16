import { render, screen, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastHost } from './Toast';
import { clearToasts, toast } from './toastStore';

const DISMISS_AFTER_MS = 6000;

beforeEach(() => {
  clearToasts();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ToastHost dismissal timing', () => {
  it('dismisses a toast on its own after the timeout', () => {
    render(<ToastHost />);
    act(() => {
      toast.error('Something broke');
    });
    expect(screen.getByText('Something broke')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(DISMISS_AFTER_MS);
    });

    expect(screen.queryByText('Something broke')).not.toBeInTheDocument();
  });

  /**
   * The regression this file exists for.
   *
   * Timers used to live in one effect on the host, keyed on the whole `toasts`
   * array. Every push produced a new array, so React ran the cleanup — clearing
   * every timer mid-flight — and started them all again from zero. The first
   * toast of a burst therefore outlived the last, and a chatty screen could keep
   * an old message on-screen indefinitely.
   */
  it('does not restart an existing toast’s countdown when another arrives', () => {
    render(<ToastHost />);
    act(() => {
      toast.error('First');
    });

    // Most of the way through the first toast's life, a second one arrives.
    act(() => {
      vi.advanceTimersByTime(DISMISS_AFTER_MS - 1000);
    });
    act(() => {
      toast.info('Second');
    });
    expect(screen.getByText('First')).toBeInTheDocument();

    // The first toast's own remaining second elapses. It should go, and only it.
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.queryByText('First')).not.toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();

    // And the second still gets its full allowance from when it appeared.
    act(() => {
      vi.advanceTimersByTime(DISMISS_AFTER_MS - 1000);
    });
    expect(screen.queryByText('Second')).not.toBeInTheDocument();
  });

  it('announces errors assertively and everything else politely', () => {
    render(<ToastHost />);
    act(() => {
      toast.error('Broke');
    });
    act(() => {
      toast.success('Saved');
    });

    expect(screen.getByText('Broke').closest('[role="status"]')).toHaveAttribute(
      'aria-live',
      'assertive',
    );
    expect(screen.getByText('Saved').closest('[role="status"]')).toHaveAttribute(
      'aria-live',
      'polite',
    );
  });
});
