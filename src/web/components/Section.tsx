import type { ReactNode } from 'react';

export function Section({
  label,
  action,
  children,
}: {
  label: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <h2 className="text-[10px] font-medium uppercase tracking-[0.09em] text-faint">{label}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
