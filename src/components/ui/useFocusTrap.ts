import { useCallback, useEffect } from 'react';
import type { RefObject } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Modal keyboard behaviour, shared by `Dialog` and by the modals that keep their
 * own chrome (the chat drawer, the quiz, the daily wisdom card): focus moves in
 * on open, Tab cycles within the panel, Escape closes, and focus returns to
 * whatever opened it.
 */
export function useFocusTrap(
  panelRef: RefObject<HTMLElement | null>,
  { active, onClose }: { active: boolean; onClose: () => void },
) {
  const focusable = useCallback(
    () => Array.from(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []),
    [panelRef],
  );

  useEffect(() => {
    if (!active) return;

    const restoreTo = document.activeElement as HTMLElement | null;
    focusable()[0]?.focus();

    return () => {
      restoreTo?.focus();
    };
  }, [active, focusable]);

  useEffect(() => {
    if (!active) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const items = focusable();
      if (items.length === 0) return;

      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [active, onClose, focusable]);
}
