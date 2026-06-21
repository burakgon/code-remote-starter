export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: T; label: string }[];
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="flex gap-1.5">
      {tabs.map((t) => {
        const on = t.id === active;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={`flex-1 rounded-lg border py-1.5 text-[11px] font-semibold transition-colors ${
              on
                ? 'border-accent/40 bg-accent/15 text-accent'
                : 'border-line text-dim hover:text-fg'
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
