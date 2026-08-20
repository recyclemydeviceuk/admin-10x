'use client';

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

const HOLD_MS = 4000;
const EXIT_MS = 320;

export type ToastInput = { ok: boolean; message: string };

type ToastItem = ToastInput & { id: string; leaving: boolean };

type ToastApi = {
  toast: (input: ToastInput) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    const hold = timers.current.get(id);
    if (hold) clearTimeout(hold);
    timers.current.delete(id);
    setItems((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, EXIT_MS);
  }, []);

  const toast = useCallback(
    (input: ToastInput) => {
      const message = input.message?.trim();
      if (!message) return;
      const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      setItems((prev) => [...prev.slice(-3), { id, ok: input.ok, message, leaving: false }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), HOLD_MS),
      );
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-4 bottom-20 z-[80] flex flex-col items-end gap-2 sm:inset-x-auto sm:right-5 sm:bottom-[5.5rem]"
        aria-live="polite"
      >
        {items.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`pointer-events-auto w-full max-w-sm border px-4 py-3 text-left text-body-sm shadow-pop sm:w-[22rem] ${
              t.leaving ? 'toast-leave' : 'toast-enter'
            } ${
              t.ok
                ? 'border-accent/50 bg-ink text-white'
                : 'border-danger/40 bg-white text-danger'
            }`}
            onClick={() => dismiss(t.id)}
          >
            <p className={`kicker mb-1 ${t.ok ? 'text-accent' : 'text-danger'}`}>{t.ok ? 'Saved' : 'Couldn’t save'}</p>
            {t.message}
          </button>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
