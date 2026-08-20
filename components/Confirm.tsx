'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Icon } from './Icon';

// =========================================================
// Branded replacement for window.confirm / window.prompt.
//   const { confirm, prompt } = useConfirm();
//   if (await confirm({ title, message, tone: 'danger' })) …
//   const value = await prompt({ title, message, placeholder });
// Promise resolves false / null when dismissed.
// =========================================================

type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'accent';
};

type PromptOptions = {
  title: string;
  message?: string;
  placeholder?: string;
  confirmLabel?: string;
  /** 'password' renders a masked input. */
  type?: 'text' | 'password';
  minLength?: number;
};

type DialogState =
  | ({ kind: 'confirm'; resolve: (ok: boolean) => void } & ConfirmOptions)
  | ({ kind: 'prompt'; resolve: (value: string | null) => void } & PromptOptions);

type ConfirmApi = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  prompt: (options: PromptOptions) => Promise<string | null>;
};

const ConfirmContext = createContext<ConfirmApi | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [value, setValue] = useState('');
  const [leaving, setLeaving] = useState(false);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = useCallback(
    (result: boolean | string | null) => {
      if (!dialog) return;
      setLeaving(true);
      setTimeout(() => {
        if (dialog.kind === 'confirm') dialog.resolve(Boolean(result));
        else dialog.resolve(typeof result === 'string' ? result : null);
        setDialog(null);
        setLeaving(false);
        setValue('');
      }, 140);
    },
    [dialog],
  );

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => setDialog({ kind: 'confirm', resolve, ...options })),
    [],
  );

  const prompt = useCallback(
    (options: PromptOptions) =>
      new Promise<string | null>((resolve) => setDialog({ kind: 'prompt', resolve, ...options })),
    [],
  );

  // Focus + Escape handling while a dialog is up.
  useEffect(() => {
    if (!dialog) return;
    const target = dialog.kind === 'prompt' ? inputRef.current : confirmBtnRef.current;
    requestAnimationFrame(() => target?.focus());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(dialog.kind === 'confirm' ? false : null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [dialog, close]);

  const tone = dialog?.kind === 'confirm' ? (dialog.tone ?? 'danger') : 'accent';
  const promptValid =
    dialog?.kind !== 'prompt' || value.trim().length >= (dialog.minLength ?? 1);

  return (
    <ConfirmContext.Provider value={{ confirm, prompt }}>
      {children}
      {dialog ? (
        <div
          className={`fixed inset-0 z-[70] flex items-end justify-center p-4 sm:items-center ${leaving ? 'modal-leave' : 'modal-enter'}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="dialog-title"
        >
          <button
            aria-label="Dismiss"
            className="absolute inset-0 bg-ink/50 backdrop-blur-[2px]"
            onClick={() => close(dialog.kind === 'confirm' ? false : null)}
            tabIndex={-1}
          />
          <div className="modal-card relative w-full max-w-sm rounded-2xl border border-paper-200 bg-white p-6 shadow-pop">
            <div className="mb-4 flex items-start gap-3.5">
              <span
                className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                  tone === 'danger' ? 'bg-danger/10 text-danger' : 'bg-accent-soft text-accent-pressed'
                }`}
              >
                <Icon name={tone === 'danger' ? 'trash' : 'shield'} className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <h2 id="dialog-title" className="text-title leading-snug">
                  {dialog.title}
                </h2>
                {dialog.kind === 'confirm' || dialog.message ? (
                  <p className="mt-1 text-body-sm leading-relaxed text-fg-muted">{dialog.message}</p>
                ) : null}
              </div>
            </div>

            {dialog.kind === 'prompt' ? (
              <form
                className="mb-5"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (promptValid) close(value.trim());
                }}
              >
                <input
                  ref={inputRef}
                  type={dialog.type ?? 'text'}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={dialog.placeholder}
                  className="field-input"
                  autoComplete="off"
                />
                {dialog.minLength ? (
                  <p className={`mt-1.5 text-caption ${promptValid ? 'text-fg-subtle' : 'text-warning'}`}>
                    At least {dialog.minLength} characters.
                  </p>
                ) : null}
              </form>
            ) : null}

            <div className="flex gap-2.5">
              <button
                type="button"
                className="btn-outline flex-1"
                onClick={() => close(dialog.kind === 'confirm' ? false : null)}
              >
                {(dialog.kind === 'confirm' && dialog.cancelLabel) || 'Cancel'}
              </button>
              <button
                ref={confirmBtnRef}
                type="button"
                disabled={!promptValid}
                className={`flex-1 ${tone === 'danger' ? 'btn-danger border-danger bg-danger text-white hover:bg-danger/90' : 'btn-accent'}`}
                onClick={() => close(dialog.kind === 'confirm' ? true : value.trim())}
              >
                {dialog.confirmLabel ?? (dialog.kind === 'confirm' ? 'Confirm' : 'Save')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used inside ConfirmProvider');
  return ctx;
}
