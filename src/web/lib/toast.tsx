import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

type Tone = 'default' | 'good' | 'error';
interface Toast {
  id: number;
  message: string;
  tone: Tone;
}

const ToastContext = createContext<(t: { message: string; tone?: Tone }) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

let counter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((t: { message: string; tone?: Tone }) => {
    const id = ++counter;
    setToasts((cur) => [...cur, { id, message: t.message, tone: t.tone ?? 'default' }]);
    setTimeout(() => setToasts((cur) => cur.filter((x) => x.id !== id)), 4000);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <ToastView key={t.id} toast={t} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastView({ toast }: { toast: Toast }) {
  const dot =
    toast.tone === 'good'
      ? 'var(--color-good)'
      : toast.tone === 'error'
        ? 'var(--color-accent)'
        : 'var(--color-dim)';
  return (
    <div className="toast-in pointer-events-auto flex w-full max-w-sm items-center gap-2.5 rounded-xl border border-line bg-surface/95 px-3.5 py-3 text-[13px] shadow-[0_12px_40px_rgba(0,0,0,0.5)] backdrop-blur">
      <span className="size-2 shrink-0 rounded-full" style={{ background: dot }} />
      <span className="min-w-0 flex-1">{toast.message}</span>
    </div>
  );
}
