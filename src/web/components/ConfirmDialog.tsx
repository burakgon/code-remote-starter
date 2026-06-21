import { useEffect } from 'react';

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center p-6">
      <button
        type="button"
        aria-label="Cancel"
        onClick={onCancel}
        className="crs-fade-in absolute inset-0 bg-black/55"
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className="crs-fade-in relative w-full max-w-xs rounded-2xl border border-line-soft bg-bg p-5 shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
      >
        <h2 className="text-[14px] font-semibold">{title}</h2>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-dim">{message}</p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-line py-2.5 text-[13px] font-medium transition-colors hover:bg-surface"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="accent-gradient flex-1 rounded-xl py-2.5 text-[13px] font-bold text-[#1a0f0a]"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
