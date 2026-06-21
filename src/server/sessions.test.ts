import { describe, it, expect, beforeEach } from 'vitest';
import { SessionManager } from './sessions.ts';
import type { Tmux } from './tmux.ts';

class FakeTmux implements Tmux {
  live = new Set<string>();
  commands: { name: string; dir: string; command: string }[] = [];
  async newSession(name: string, dir: string, command: string) {
    this.live.add(name);
    this.commands.push({ name, dir, command });
  }
  async listSessionNames() {
    return [...this.live];
  }
  async killSession(name: string) {
    this.live.delete(name);
  }
  async renameSession(oldName: string, newName: string) {
    this.live.delete(oldName);
    this.live.add(newName);
  }
}

const BASE = 'claude --dangerously-skip-permissions --effort max';
let tmux: FakeTmux;
let ids: string[];
function manager() {
  ids = ['aaaa', 'bbbb', 'cccc'];
  return new SessionManager({
    tmux,
    baseCommand: BASE,
    idFactory: () => ids.shift()!,
    now: () => 1000,
  });
}
beforeEach(() => {
  tmux = new FakeTmux();
});

describe('SessionManager', () => {
  it('create launches a tmux session with the built command and tracks it', async () => {
    const m = manager();
    const s = await m.create({ dir: '/p/code-starter', name: 'code-starter' });
    expect(s.tmuxName).toBe('crs-aaaa');
    expect(s.status).toBe('running');
    expect(s.startedAt).toBe(1000);
    expect(tmux.live.has('crs-aaaa')).toBe(true);
    expect(tmux.commands[0]!.command).toBe(`${BASE} --remote-control 'code-starter'`);
    expect(tmux.commands[0]!.dir).toBe('/p/code-starter');
    expect(m.list()).toHaveLength(1);
  });

  it('stop kills the tmux session and marks it ended', async () => {
    const m = manager();
    const s = await m.create({ dir: '/p/a', name: 'a' });
    await m.stop(s.id);
    expect(tmux.live.has(s.tmuxName)).toBe(false);
    expect(m.list().find((x) => x.id === s.id)!.status).toBe('ended');
  });

  it('rename updates the display name', async () => {
    const m = manager();
    const s = await m.create({ dir: '/p/a', name: 'a' });
    const renamed = m.rename(s.id, 'b');
    expect(renamed.name).toBe('b');
    expect(m.list()[0]!.name).toBe('b');
  });

  it('refresh marks sessions ended when tmux no longer lists them', async () => {
    const m = manager();
    const s = await m.create({ dir: '/p/a', name: 'a' });
    tmux.live.delete(s.tmuxName); // session died outside our control
    const changed = await m.refresh();
    expect(changed).toBe(true);
    expect(m.list()[0]!.status).toBe('ended');
  });

  it('onChange fires on create and stop', async () => {
    const m = manager();
    const events: number[] = [];
    m.onChange((sessions) => events.push(sessions.length));
    const s = await m.create({ dir: '/p/a', name: 'a' });
    await m.stop(s.id);
    expect(events.length).toBeGreaterThanOrEqual(2);
  });
});
