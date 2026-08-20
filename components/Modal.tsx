'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';

// Generic centered modal — used for create/edit forms so trigger buttons can
// live in the page-header action row without breaking its alignment.
export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="modal-enter fixed inset-0 z-[70] flex items-end justify-center p-4 sm:items-center" role="dialog" aria-modal="true">
      <button aria-label="Close" tabIndex={-1} className="absolute inset-0 bg-ink/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className={`modal-card relative max-h-[85vh] w-full overflow-y-auto rounded-2xl border border-paper-200 bg-white p-6 shadow-pop ${wide ? 'max-w-2xl' : 'max-w-md'}`}>
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-title">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-fg-subtle transition-colors hover:bg-paper-100 hover:text-fg"
          >
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
