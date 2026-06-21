import { useEffect, type ReactNode } from 'react';

/** A bottom sheet on mobile, a centered modal on wider screens. */
export function Sheet({
  onClose,
  children,
  full = false,
  ariaLabel,
}: {
  onClose: () => void;
  children: ReactNode;
  full?: boolean;
  ariaLabel: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end sm:items-center sm:justify-center sm:p-6">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="crs-fade-in absolute inset-0 bg-black/55"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        className={`crs-sheet-in relative flex w-full max-w-xl flex-col overflow-hidden rounded-t-3xl border border-line-soft bg-bg shadow-[0_-20px_60px_rgba(0,0,0,0.6)] sm:max-w-lg sm:rounded-3xl ${
          full ? 'h-[92dvh] sm:h-[80dvh]' : 'max-h-[88dvh]'
        }`}
      >
        {children}
      </div>
    </div>
  );
}
