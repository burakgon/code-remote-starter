import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { api, errorMessage } from '../lib/api.ts';
import type { Session } from '../lib/types.ts';
import { useSessions } from '../lib/useSessions.ts';
import { useTick } from '../lib/useTick.ts';
import { useToast } from '../lib/toast.tsx';
import { Header } from './Header.tsx';
import { Section } from './Section.tsx';
import { EmptyState } from './EmptyState.tsx';
import { SessionRow } from './SessionRow.tsx';
import { ConfirmDialog } from './ConfirmDialog.tsx';

export function Home({ onNew }: { onNew: () => void }) {
  const { sessions, connected } = useSessions();
  const meta = useQuery({ queryKey: ['meta'], queryFn: api.meta });
  const home = meta.data?.home;
  const toast = useToast();
  useTick(30_000);

  const [confirmStop, setConfirmStop] = useState<Session | null>(null);

  const running = sessions.filter((s) => s.status === 'running');
  const ended = sessions.filter((s) => s.status === 'ended');

  // DELETE stops a running session and forgets an already-ended one.
  const del = async (id: string) => {
    try {
      await api.stopSession(id);
    } catch (err) {
      toast({ message: errorMessage(err), tone: 'error' });
    }
  };
  const rename = async (id: string, name: string) => {
    try {
      await api.renameSession(id, name);
    } catch (err) {
      toast({ message: errorMessage(err), tone: 'error' });
    }
  };
  const clearEnded = async () => {
    try {
      await api.clearEnded();
    } catch (err) {
      toast({ message: errorMessage(err), tone: 'error' });
    }
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-6 px-4 pb-28 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <Header runningCount={running.length} connected={connected} />

      {!connected && (
        <div className="flex items-center gap-2 rounded-lg border border-warn/30 bg-warn/10 px-3 py-2 text-[11px] text-warn">
          <span className="size-1.5 animate-pulse rounded-full bg-warn" />
          Reconnecting to the server…
        </div>
      )}

      <Section label="Running">
        {running.length === 0 ? (
          <EmptyState>No running sessions. Start one with New session below.</EmptyState>
        ) : (
          <div className="flex flex-col gap-2">
            {running.map((s) => (
              <SessionRow
                key={s.id}
                session={s}
                home={home}
                onRequestStop={setConfirmStop}
                onDismiss={del}
                onRename={rename}
              />
            ))}
          </div>
        )}
      </Section>

      {ended.length > 0 && (
        <Section
          label="Ended"
          action={
            <button
              type="button"
              onClick={clearEnded}
              className="text-[10px] font-medium uppercase tracking-[0.09em] text-faint transition-colors hover:text-fg"
            >
              Clear
            </button>
          }
        >
          <div className="flex flex-col gap-2">
            {ended.map((s) => (
              <SessionRow
                key={s.id}
                session={s}
                home={home}
                onRequestStop={setConfirmStop}
                onDismiss={del}
                onRename={rename}
              />
            ))}
          </div>
        </Section>
      )}

      <div className="fixed inset-x-0 bottom-0 z-40 bg-gradient-to-t from-bg via-bg to-transparent pb-[max(1rem,env(safe-area-inset-bottom))] pt-8">
        <div className="mx-auto w-full max-w-xl px-4">
          <button
            type="button"
            onClick={onNew}
            className="accent-gradient flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[15px] font-bold text-[#1a0f0a] transition-transform active:scale-[0.99]"
          >
            <Plus size={17} strokeWidth={2.6} />
            New session
          </button>
        </div>
      </div>

      {confirmStop && (
        <ConfirmDialog
          title="Stop session?"
          message={`This ends the Claude Code session "${confirmStop.name}". You can't undo it.`}
          confirmLabel="Stop"
          onCancel={() => setConfirmStop(null)}
          onConfirm={() => {
            void del(confirmStop.id);
            setConfirmStop(null);
          }}
        />
      )}
    </div>
  );
}
