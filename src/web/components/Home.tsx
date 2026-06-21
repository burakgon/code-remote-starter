import { Plus } from 'lucide-react';
import { api, errorMessage } from '../lib/api.ts';
import { useSessions } from '../lib/useSessions.ts';
import { useTick } from '../lib/useTick.ts';
import { useToast } from '../lib/toast.tsx';
import { Header } from './Header.tsx';
import { Section } from './Section.tsx';
import { EmptyState } from './EmptyState.tsx';
import { SessionRow } from './SessionRow.tsx';

export function Home({ onNew }: { onNew: () => void }) {
  const { sessions, connected } = useSessions();
  const toast = useToast();
  useTick(30_000);

  const running = sessions.filter((s) => s.status === 'running');
  const ended = sessions.filter((s) => s.status === 'ended');

  const stop = async (id: string) => {
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

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-6 px-4 pb-28 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <Header runningCount={running.length} connected={connected} />

      <Section label="Running">
        {running.length === 0 ? (
          <EmptyState>No running sessions. Start one with New session below.</EmptyState>
        ) : (
          <div className="flex flex-col gap-2">
            {running.map((s) => (
              <SessionRow key={s.id} session={s} onStop={stop} onRename={rename} />
            ))}
          </div>
        )}
      </Section>

      {ended.length > 0 && (
        <Section label="Ended">
          <div className="flex flex-col gap-2">
            {ended.map((s) => (
              <SessionRow key={s.id} session={s} onStop={stop} onRename={rename} />
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
    </div>
  );
}
