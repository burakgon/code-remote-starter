import type { ReactNode } from 'react';

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line-soft px-4 py-6 text-center text-[13px] text-dim">
      {children}
    </div>
  );
}
