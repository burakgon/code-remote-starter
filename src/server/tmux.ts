import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

export interface Tmux {
  newSession(name: string, dir: string, command: string): Promise<void>;
  listSessionNames(): Promise<string[]>;
  killSession(name: string): Promise<void>;
  renameSession(oldName: string, newName: string): Promise<void>;
}

export function createTmux(): Tmux {
  return {
    async newSession(name, dir, command) {
      await run('tmux', ['new-session', '-d', '-s', name, '-c', dir, command]);
    },
    async listSessionNames() {
      try {
        const { stdout } = await run('tmux', ['list-sessions', '-F', '#{session_name}']);
        return stdout
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean);
      } catch (err: unknown) {
        // tmux exits non-zero with "no server running" when there are no sessions.
        const msg = err instanceof Error ? err.message : String(err);
        if (/no server running|no such file/i.test(msg)) return [];
        throw err;
      }
    },
    async killSession(name) {
      await run('tmux', ['kill-session', '-t', name]);
    },
    async renameSession(oldName, newName) {
      await run('tmux', ['rename-session', '-t', oldName, newName]);
    },
  };
}
