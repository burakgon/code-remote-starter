import type { ReactNode } from 'react';

export function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="text-[10px] font-medium uppercase tracking-[0.09em] text-faint">{label}</h2>
      {children}
    </section>
  );
}
