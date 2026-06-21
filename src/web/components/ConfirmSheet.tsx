import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CornerDownLeft, Folder } from 'lucide-react';
import { api, errorMessage } from '../lib/api.ts';
import { basename, tildePath } from '../lib/format.ts';
import { useToast } from '../lib/toast.tsx';
import { Sheet } from './Sheet.tsx';

export function ConfirmSheet({
  dir,
  onClose,
  onLaunched,
}: {
  dir: string;
  onClose: () => void;
  onLaunched: () => void;
}) {
  const meta = useQuery({ queryKey: ['meta'], queryFn: api.meta });
  const toast = useToast();
  const qc = useQueryClient();
  const [name, setName] = useState(basename(dir));
  const [busy, setBusy] = useState(false);

  const start = async () => {
    const finalName = name.trim() || basename(dir);
    setBusy(true);
    try {
      await api.createSession(dir, finalName);
      qc.invalidateQueries({ queryKey: ['recent'] });
      toast({ message: `Launched in ${finalName}`, tone: 'good' });
      onLaunched();
    } catch (err) {
      toast({ message: errorMessage(err), tone: 'error' });
      setBusy(false);
    }
  };

  return (
    <Sheet onClose={onClose} ariaLabel="Start a session">
      <div className="flex flex-col gap-4 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto h-1 w-9 rounded-full bg-line" />
        <h2 className="text-[15px] font-semibold">Start a session</h2>

        <div className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3">
          <Folder size={17} className="shrink-0 text-accent" />
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-[13px] font-semibold">{basename(dir)}</span>
            <span className="truncate font-mono text-[10px] text-dim">{tildePath(dir, meta.data?.home)}</span>
          </div>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-[9px] font-medium uppercase tracking-[0.08em] text-faint">Session name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') start();
            }}
            autoCapitalize="off"
            spellCheck={false}
            className="rounded-xl border border-line bg-surface px-3 py-2.5 text-[13px] outline-none transition-colors focus:border-accent"
          />
        </label>

        {meta.data?.baseCommand && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[9px] font-medium uppercase tracking-[0.08em] text-faint">Command</span>
            <code className="block overflow-x-auto rounded-xl border border-line-soft bg-surface-2 px-3 py-2.5 font-mono text-[10.5px] leading-relaxed text-dim">
              {meta.data.baseCommand}
            </code>
          </div>
        )}

        <div className="flex items-center gap-2 text-[11px] text-dim">
          <span className="size-1.5 rounded-full bg-good" />
          Remote Control on — appears in the Claude app
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={start}
          className="accent-gradient flex items-center justify-center gap-2 rounded-2xl py-3.5 text-[14px] font-bold text-[#1a0f0a] transition-transform active:scale-[0.99] disabled:opacity-60"
        >
          {busy ? 'Starting…' : 'Start session'}
          {!busy && <CornerDownLeft size={13} />}
        </button>
      </div>
    </Sheet>
  );
}
