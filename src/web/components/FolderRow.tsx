import { ChevronRight, Folder } from 'lucide-react';
import type { DirEntry } from '../lib/types.ts';

export function FolderRow({
  entry,
  selected,
  onSelect,
  onOpen,
}: {
  entry: DirEntry;
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-2.5 rounded-xl border px-2.5 py-2.5 transition-colors ${
        selected ? 'border-accent/40 bg-accent/10' : 'border-transparent hover:bg-surface'
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
      >
        <Folder size={15} className={selected ? 'shrink-0 text-accent' : 'shrink-0 text-faint'} />
        <span className={`truncate text-[13px] ${entry.hidden ? 'text-dim' : 'font-medium'}`}>
          {entry.name}
        </span>
        {entry.isGitRepo && (
          <span className="size-1.5 shrink-0 rounded-full bg-good" title="Git repository" />
        )}
        {entry.usedWithClaude && (
          <span className="shrink-0 rounded border border-accent/40 px-1 py-px text-[8px] font-medium text-accent">
            claude
          </span>
        )}
      </button>
      <button
        type="button"
        aria-label={`Open ${entry.name}`}
        onClick={onOpen}
        className="grid size-7 shrink-0 place-items-center rounded-md text-faint transition-colors hover:text-fg"
      >
        <ChevronRight size={15} />
      </button>
    </div>
  );
}
