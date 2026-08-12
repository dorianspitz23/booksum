import { useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { useFocusTrap } from './useFocusTrap';

interface DialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Tailwind max-width class for the panel. */
  size?: string;
}

export function Dialog({ open, title, onClose, children, size = 'max-w-xl' }: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useFocusTrap(panelRef, { active: open, onClose });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div
        data-testid="dialog-backdrop"
        className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative w-full ${size} bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200`}
      >
        <div className="flex justify-between items-center gap-4 p-6 sm:px-8 sm:pt-8 sm:pb-4">
          <h2 id={titleId} className="text-2xl font-bold text-gray-900">
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        <div className="px-6 pb-6 sm:px-8 sm:pb-8 overflow-y-auto max-h-[75vh]">{children}</div>
      </div>
    </div>
  );
}
