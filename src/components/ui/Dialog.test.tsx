import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Dialog } from './Dialog';

function Harness({
  onClose = vi.fn(),
  hasUnsavedInput = false,
}: {
  onClose?: () => void;
  hasUnsavedInput?: boolean;
}) {
  return (
    <>
      <button>outside</button>
      <Dialog open title="Add a book" onClose={onClose} hasUnsavedInput={hasUnsavedInput}>
        <button>first</button>
        <button>second</button>
      </Dialog>
    </>
  );
}

describe('Dialog', () => {
  it('exposes itself as a labelled modal', () => {
    render(<Harness />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName('Add a book');
  });

  it('moves focus into the dialog on open', async () => {
    render(<Harness />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus());
  });

  it('closes on Escape', async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('traps Tab inside the dialog', async () => {
    render(<Harness />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus());

    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'first' })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'second' })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
  });

  it('traps Shift+Tab backwards', async () => {
    render(<Harness />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus());
    await userEvent.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'second' })).toHaveFocus();
  });

  it('restores focus to the trigger when it closes', async () => {
    function Toggle() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>open</button>
          <Dialog open={open} title="Settings" onClose={() => setOpen(false)}>
            <button>inside</button>
          </Dialog>
        </>
      );
    }
    render(<Toggle />);
    const trigger = screen.getByRole('button', { name: 'open' });
    await userEvent.click(trigger);
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('closes when the backdrop is clicked', async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await userEvent.click(screen.getByTestId('dialog-backdrop'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('renders nothing when closed', () => {
    render(
      <Dialog open={false} title="Hidden" onClose={vi.fn()}>
        <button>inside</button>
      </Dialog>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('hides the page behind it from assistive tech', () => {
    // Trapping Tab is only half of aria-modal. A screen reader walks the
    // accessibility tree rather than tabbing, so the page behind an open dialog
    // stayed fully readable — exactly what aria-modal promises it is not.
    render(<Harness />);

    // Still in the DOM, but out of the accessibility tree: role queries resolve
    // against the same tree a screen reader reads, so this is the real check.
    expect(screen.getByText('outside')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'outside' })).not.toBeInTheDocument();

    // The dialog's own content stays reachable.
    expect(screen.getByRole('button', { name: 'first' })).toBeInTheDocument();
  });

  it('gives the page back when it closes', () => {
    const { unmount } = render(<Harness />);
    expect(screen.queryByRole('button', { name: 'outside' })).not.toBeInTheDocument();

    unmount();

    // Left hidden, the whole app would be unreachable to a screen reader after
    // the first dialog anyone opened.
    expect(document.querySelectorAll('[aria-hidden="true"]')).toHaveLength(0);
  });
});

/**
 * A backdrop click is the only dismissal that happens by accident — a click
 * aimed at the panel that lands a few pixels outside it. When the dialog holds
 * typed input, obeying that click throws the work away with no warning and no
 * undo. Escape and the close button are deliberate, so they keep working.
 */
describe('Dialog backdrop dismissal', () => {
  it('closes on a backdrop click when there is nothing to lose', async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);

    await userEvent.click(screen.getByTestId('dialog-backdrop'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ignores a backdrop click while the dialog holds unsaved input', async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} hasUnsavedInput />);

    await userEvent.click(screen.getByTestId('dialog-backdrop'));

    expect(onClose).not.toHaveBeenCalled();
  });

  it('still closes on Escape with unsaved input, because that is deliberate', async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} hasUnsavedInput />);

    await userEvent.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
