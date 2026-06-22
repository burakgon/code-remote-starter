import { describe, it, expect, beforeEach } from 'vitest';
import { createApi } from './api.ts';
import { SessionManager } from './sessions.ts';
import type { Tmux } from './tmux.ts';
import type { Session } from './types.ts';

const TOKEN = 'a'.repeat(64);
const AUTH = { Cookie: `crs_token=${TOKEN}`, 'Content-Type': 'application/json' };

class FakeTmux implements Tmux {
  live = new Set<string>();
  async newSession(name: string) {
    this.live.add(name);
  }
  async listSessionNames() {
    return [...this.live];
  }
  async listSessions() {
    return [...this.live].map((n) => ({ name: n, path: `/x/${n}` }));
  }
  async killSession(name: string) {
    this.live.delete(name);
  }
  async renameSession() {}
  async capturePane() {
    return '';
  }
}

let app: ReturnType<typeof createApi>;
let sessions: SessionManager;
beforeEach(() => {
  sessions = new SessionManager({ tmux: new FakeTmux(), baseCommand: 'claude' });
  app = createApi({ sessions, token: TOKEN });
});

describe('sessions API', () => {
  it('GET /api/sessions starts empty', async () => {
    const res = await app.request('/api/sessions', { headers: AUTH });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sessions: [] });
  });

  it('POST creates a session', async () => {
    const res = await app.request('/api/sessions', {
      method: 'POST',
      headers: AUTH,
      body: JSON.stringify({ dir: '/p/code-starter', name: 'code-starter' }),
    });
    expect(res.status).toBe(201);
    const { session } = (await res.json()) as { session: Session };
    expect(session.name).toBe('code-starter');
    expect(session.status).toBe('running');
  });

  it('POST with invalid body returns 400', async () => {
    const res = await app.request('/api/sessions', {
      method: 'POST',
      headers: AUTH,
      body: JSON.stringify({ dir: '/p' }),
    });
    expect(res.status).toBe(400);
  });

  it('DELETE stops a session', async () => {
    const created = (await (
      await app.request('/api/sessions', {
        method: 'POST',
        headers: AUTH,
        body: JSON.stringify({ dir: '/p/a', name: 'a' }),
      })
    ).json()) as { session: Session };
    const res = await app.request(`/api/sessions/${created.session.id}`, {
      method: 'DELETE',
      headers: AUTH,
    });
    expect(res.status).toBe(204);
    expect(sessions.list()[0]!.status).toBe('ended');
  });

  it('DELETE unknown id returns 404', async () => {
    const res = await app.request('/api/sessions/nope', { method: 'DELETE', headers: AUTH });
    expect(res.status).toBe(404);
  });

  it('DELETE on an ended session removes it from the list', async () => {
    const created = (await (
      await app.request('/api/sessions', {
        method: 'POST',
        headers: AUTH,
        body: JSON.stringify({ dir: '/p/a', name: 'a' }),
      })
    ).json()) as { session: Session };
    await app.request(`/api/sessions/${created.session.id}`, { method: 'DELETE', headers: AUTH });
    expect(sessions.list()[0]!.status).toBe('ended');
    const res = await app.request(`/api/sessions/${created.session.id}`, {
      method: 'DELETE',
      headers: AUTH,
    });
    expect(res.status).toBe(204);
    expect(sessions.list()).toHaveLength(0);
  });

  it('POST /api/sessions/clear-ended removes ended sessions', async () => {
    const a = (await (
      await app.request('/api/sessions', {
        method: 'POST',
        headers: AUTH,
        body: JSON.stringify({ dir: '/p/a', name: 'a' }),
      })
    ).json()) as { session: Session };
    await app.request('/api/sessions', {
      method: 'POST',
      headers: AUTH,
      body: JSON.stringify({ dir: '/p/b', name: 'b' }),
    });
    await app.request(`/api/sessions/${a.session.id}`, { method: 'DELETE', headers: AUTH });
    const res = await app.request('/api/sessions/clear-ended', { method: 'POST', headers: AUTH });
    expect(res.status).toBe(200);
    expect(sessions.list()).toHaveLength(1);
    expect(sessions.list()[0]!.status).toBe('running');
  });

  it('PATCH renames a session', async () => {
    const created = (await (
      await app.request('/api/sessions', {
        method: 'POST',
        headers: AUTH,
        body: JSON.stringify({ dir: '/p/a', name: 'a' }),
      })
    ).json()) as { session: Session };
    const res = await app.request(`/api/sessions/${created.session.id}`, {
      method: 'PATCH',
      headers: AUTH,
      body: JSON.stringify({ name: 'b' }),
    });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { session: Session }).session.name).toBe('b');
  });

  it('requires auth', async () => {
    const res = await app.request('/api/sessions');
    expect(res.status).toBe(401);
  });
});
