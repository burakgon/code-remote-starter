import { Search } from 'lucide-react';

export function FilterInput({
  value,
  onChange,
  onSubmitPath,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmitPath: (path: string) => void;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-line bg-surface px-3 py-2.5 transition-colors focus-within:border-accent/60">
      <Search size={13} className="shrink-0 text-faint" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            const v = value.trim();
            if (v.startsWith('/') || v.startsWith('~')) onSubmitPath(v);
          }
        }}
        placeholder="Filter or paste a path"
        autoCapitalize="off"
        autoComplete="off"
        spellCheck={false}
        className="min-w-0 flex-1 bg-transparent text-[12.5px] outline-none placeholder:text-faint"
      />
    </div>
  );
}
