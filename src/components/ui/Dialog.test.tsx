import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Dialog } from './Dialog';

function Harness({ onClose = vi.fn() }: { onClose?: () => void }) {
  return (
    <>
      <button>outside</button>
      <Dialog open title="Add a book" onClose={onClose}>
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
});
