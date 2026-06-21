import { describe, it, expect, beforeEach } from 'vitest';
import { SessionBroadcaster } from './ws.ts';
import { SessionManager } from './sessions.ts';
import type { Tmux } from './tmux.ts';

class FakeTmux implements Tmux {
  live = new Set<string>();
  async newSession(name: string) {
    this.live.add(name);
  }
  async listSessionNames() {
    return [...this.live];
  }
  async killSession(name: string) {
    this.live.delete(name);
  }
  async renameSession() {}
}

class FakeClient {
  readyState = 1; // OPEN
  messages: string[] = [];
  send(data: string) {
    this.messages.push(data);
  }
}

let sessions: SessionManager;
let broadcaster: SessionBroadcaster;
beforeEach(() => {
  sessions = new SessionManager({ tmux: new FakeTmux(), baseCommand: 'claude' });
  broadcaster = new SessionBroadcaster(sessions);
});

describe('SessionBroadcaster', () => {
  it('sends a snapshot to a newly added client', () => {
    const client = new FakeClient();
    broadcaster.add(client);
    expect(client.messages).toHaveLength(1);
    expect(JSON.parse(client.messages[0]!)).toEqual({ type: 'sessions', sessions: [] });
  });

  it('pushes updates to clients when sessions change', async () => {
    const client = new FakeClient();
    broadcaster.add(client);
    await sessions.create({ dir: '/p/a', name: 'a' });
    const last = JSON.parse(client.messages.at(-1)!);
    expect(last.type).toBe('sessions');
    expect(last.sessions).toHaveLength(1);
  });

  it('does not send to closed clients', async () => {
    const client = new FakeClient();
    broadcaster.add(client);
    client.readyState = 3; // CLOSED
    await sessions.create({ dir: '/p/a', name: 'a' });
    expect(client.messages).toHaveLength(1); // only the initial snapshot
  });
});
