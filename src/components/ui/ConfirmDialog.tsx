import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Dialog } from './Dialog';

export interface ConfirmOptions {
  title: string;
  body: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | undefined>(undefined);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((next) => {
    setOptions(next);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const settle = useCallback((value: boolean) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setOptions(null);
  }, []);

  const value = useMemo(() => confirm, [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <Dialog
        open={options !== null}
        title={options?.title ?? ''}
        onClose={() => settle(false)}
        size="max-w-md"
      >
        <p className="text-gray-600 leading-relaxed mb-8">{options?.body}</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={() => settle(false)}
            className="px-5 py-3 rounded-xl font-bold text-gray-600 hover:bg-gray-100 transition-all"
          >
            {options?.cancelLabel ?? 'Cancel'}
          </button>
          <button
            onClick={() => settle(true)}
            className={`px-5 py-3 rounded-xl font-bold text-white shadow-lg transition-all ${
              options?.danger
                ? 'bg-red-600 hover:bg-red-700 shadow-red-100'
                : 'bg-orange-600 hover:bg-orange-700 shadow-orange-100'
            }`}
          >
            {options?.confirmLabel ?? 'Confirm'}
          </button>
        </div>
      </Dialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const context = useContext(ConfirmContext);
  if (!context) throw new Error('useConfirm must be used within a ConfirmProvider');
  return context;
}
