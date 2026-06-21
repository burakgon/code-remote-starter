import { useState } from 'react';
import { Pencil, Square } from 'lucide-react';
import type { Session } from '../lib/types.ts';
import { relativeTime } from '../lib/format.ts';
import { StatusDot } from './StatusDot.tsx';

export function SessionRow({
  session,
  onStop,
  onRename,
}: {
  session: Session;
  onStop: (id: string) => void;
  onRename: (id: string, name: string) => void;
}) {
  const running = session.status === 'running';
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(session.name);

  const commit = () => {
    const name = draft.trim();
    setEditing(false);
    if (name && name !== session.name) onRename(session.id, name);
    else setDraft(session.name);
  };

  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5">
      <StatusDot status={session.status} />
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') {
              setDraft(session.name);
              setEditing(false);
            }
          }}
          className="min-w-0 flex-1 rounded-md bg-bg px-1.5 py-0.5 text-[13.5px] outline-none ring-1 ring-line focus:ring-accent"
        />
      ) : (
        <button
          type="button"
          onClick={() => running && setEditing(true)}
          className={`min-w-0 flex-1 truncate text-left text-[13.5px] font-medium ${running ? '' : 'text-dim'}`}
        >
          {session.name}
        </button>
      )}
      <span className="shrink-0 font-mono text-[10px] text-dim">
        {running ? relativeTime(session.startedAt) : 'ended'}
      </span>
      {running && (
        <>
          <button
            type="button"
            aria-label="Rename session"
            onClick={() => setEditing(true)}
            className="grid size-7 place-items-center rounded-md text-faint transition-colors hover:text-fg"
          >
            <Pencil size={13} />
          </button>
          <button
            type="button"
            aria-label="Stop session"
            onClick={() => onStop(session.id)}
            className="grid size-7 place-items-center rounded-md text-faint transition-colors hover:text-accent"
          >
            <Square size={13} />
          </button>
        </>
      )}
    </div>
  );
}
