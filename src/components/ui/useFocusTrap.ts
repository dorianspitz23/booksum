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
  const focusable = useCallback(() => {
    // `querySelectorAll<HTMLElement>` is an assertion, not a check — the generic
    // only tells TypeScript what to believe about a runtime selector string. The
    // selector can match SVG-owned elements, which have no `.focus()`, so the
    // narrowing is performed for real here. Everything downstream then genuinely
    // has the method this hook calls on it.
    const found = panelRef.current?.querySelectorAll(FOCUSABLE) ?? [];
    return Array.from(found).filter((node): node is HTMLElement => node instanceof HTMLElement);
  }, [panelRef]);

  useEffect(() => {
    if (!active) return;

    const restoreTo = document.activeElement as HTMLElement | null;
    focusable()[0]?.focus();

    return () => {
      // A trigger that no longer exists — the delete button on a book the dialog
      // just deleted, say — cannot take focus back, and calling focus() on a
      // detached node silently drops the user to <body>: no visible focus ring,
      // and Tab restarts from the top of the page. Falling back to the app root
      // at least keeps them near where they were.
      if (restoreTo?.isConnected) {
        restoreTo.focus();
        return;
      }
      const root = document.getElementById('root');
      if (root) {
        root.setAttribute('tabindex', '-1');
        root.focus();
      }
    };
  }, [active, focusable]);

  /**
   * Hides everything outside the panel from assistive tech.
   *
   * Trapping Tab is only half of `aria-modal`. A screen reader does not navigate
   * by Tab — it walks the accessibility tree — so the page behind an open dialog
   * stayed fully readable and announceable, which is exactly what `aria-modal`
   * on the panel promises is not the case.
   *
   * Every dialog here renders inline in the React tree rather than in a portal,
   * so this walks from the panel to `body` marking each ancestor's *siblings*
   * inert, leaving only the path to the panel reachable.
   */
  useEffect(() => {
    const panel = panelRef.current;
    if (!active || !panel) return;

    const changed: { element: Element; hadInert: boolean; ariaHidden: string | null }[] = [];

    for (let node: HTMLElement | null = panel; node && node !== document.body;) {
      const parent: HTMLElement | null = node.parentElement;
      if (!parent) break;

      for (const sibling of Array.from(parent.children)) {
        if (sibling === node) continue;
        changed.push({
          element: sibling,
          hadInert: (sibling as HTMLElement).inert === true,
          ariaHidden: sibling.getAttribute('aria-hidden'),
        });
        (sibling as HTMLElement).inert = true;
        sibling.setAttribute('aria-hidden', 'true');
      }
      node = parent;
    }

    return () => {
      // Restored rather than cleared: a sibling may have been legitimately hidden
      // before this dialog opened, and stacked dialogs unwind in reverse order.
      for (const { element, hadInert, ariaHidden } of changed) {
        (element as HTMLElement).inert = hadInert;
        if (ariaHidden === null) element.removeAttribute('aria-hidden');
        else element.setAttribute('aria-hidden', ariaHidden);
      }
    };
  }, [active, panelRef]);

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
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;

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
