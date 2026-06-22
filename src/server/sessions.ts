import { randomBytes } from 'node:crypto';
import type { Session } from './types.ts';
import type { Tmux } from './tmux.ts';
import { buildSessionCommand } from './command.ts';

export interface CreateSessionInput {
  dir: string;
  name: string;
}

interface SessionManagerOptions {
  tmux: Tmux;
  baseCommand: string;
  idFactory?: () => string;
  now?: () => number;
}

export class SessionManager {
  private readonly tmux: Tmux;
  private readonly baseCommand: string;
  private readonly idFactory: () => string;
  private readonly now: () => number;
  private readonly sessions = new Map<string, Session>();
  private readonly listeners = new Set<(sessions: Session[]) => void>();

  constructor(opts: SessionManagerOptions) {
    this.tmux = opts.tmux;
    this.baseCommand = opts.baseCommand;
    this.idFactory = opts.idFactory ?? (() => randomBytes(4).toString('hex'));
    this.now = opts.now ?? (() => Date.now());
  }

  list(): Session[] {
    return [...this.sessions.values()].sort((a, b) => b.startedAt - a.startedAt);
  }

  async create(input: CreateSessionInput): Promise<Session> {
    const id = this.idFactory();
    const tmuxName = `crs-${id}`;
    const command = buildSessionCommand(this.baseCommand, input.name);
    await this.tmux.newSession(tmuxName, input.dir, command);
    const session: Session = {
      id,
      name: input.name,
      dir: input.dir,
      tmuxName,
      startedAt: this.now(),
      status: 'running',
    };
    this.sessions.set(id, session);
    this.emit();
    return session;
  }

  async stop(id: string): Promise<void> {
    const session = this.sessions.get(id);
    if (!session) throw new Error(`Unknown session: ${id}`);
    if (session.status === 'running') {
      await this.tmux.killSession(session.tmuxName);
      session.status = 'ended';
      this.emit();
    }
  }

  rename(id: string, name: string): Session {
    const session = this.sessions.get(id);
    if (!session) throw new Error(`Unknown session: ${id}`);
    session.name = name;
    this.emit();
    return session;
  }

  get(id: string): Session | undefined {
    return this.sessions.get(id);
  }

  /** Forget a session (used to dismiss an already-ended one from the list). */
  remove(id: string): void {
    if (this.sessions.delete(id)) this.emit();
  }

  /** Forget all ended sessions. */
  clearEnded(): void {
    let changed = false;
    for (const [id, session] of this.sessions) {
      if (session.status === 'ended') {
        this.sessions.delete(id);
        changed = true;
      }
    }
    if (changed) this.emit();
  }

  /** Re-adopt crs- tmux sessions that already exist (e.g. after a restart). */
  async adopt(): Promise<void> {
    let changed = false;
    for (const { name, path } of await this.tmux.listSessions()) {
      if (!name.startsWith('crs-')) continue;
      const id = name.slice('crs-'.length);
      if (this.sessions.has(id)) continue;
      this.sessions.set(id, {
        id,
        name: path.split('/').filter(Boolean).pop() || name,
        dir: path,
        tmuxName: name,
        startedAt: this.now(),
        status: 'running',
      });
      changed = true;
    }
    if (changed) this.emit();
  }

  async refresh(): Promise<boolean> {
    const live = new Set(await this.tmux.listSessionNames());
    let changed = false;
    for (const session of this.sessions.values()) {
      if (session.status !== 'running') continue;
      if (!live.has(session.tmuxName)) {
        session.status = 'ended';
        changed = true;
      } else if (!session.claudeUrl) {
        // Claude prints its claude.ai session URL a moment after starting; grab it.
        const url = await this.captureUrl(session.tmuxName);
        if (url) {
          session.claudeUrl = url;
          changed = true;
        }
      }
    }
    if (changed) this.emit();
    return changed;
  }

  private async captureUrl(tmuxName: string): Promise<string | undefined> {
    const pane = await this.tmux.capturePane(tmuxName);
    return pane.match(/https:\/\/claude\.ai\/code\/session_[A-Za-z0-9_-]+/)?.[0];
  }

  onChange(cb: (sessions: Session[]) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private emit(): void {
    const snapshot = this.list();
    for (const cb of this.listeners) cb(snapshot);
  }
}
