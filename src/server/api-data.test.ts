import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApi } from './api.ts';
import { SessionManager } from './sessions.ts';
import { BookmarkStore, type Bookmark } from './bookmarks.ts';
import type { Tmux } from './tmux.ts';
import type { DirListing } from './fs.ts';
import type { RecentDir } from './recent.ts';

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

let dir: string;
let app: ReturnType<typeof createApi>;
let launched: string[];
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'crs-api-'));
  launched = [];
  const sessions = new SessionManager({ tmux: new FakeTmux(), baseCommand: 'claude' });
  const bookmarks = new BookmarkStore({ dir });
  const listing: DirListing = {
    path: '/Users/x/Developer',
    parent: '/Users/x',
    entries: [
      {
        name: 'code-starter',
        path: '/Users/x/Developer/code-starter',
        isGitRepo: true,
        usedWithClaude: true,
        hidden: false,
      },
    ],
  };
  const recent: RecentDir[] = [
    { path: '/Users/x/Developer/code-starter', lastUsedAt: 1000, source: 'launch' },
  ];
  app = createApi({
    token: TOKEN,
    sessions,
    bookmarks,
    listDir: () => listing,
    makeDir: (parent, name) => `${parent}/${name}`,
    getRecent: () => recent,
    onLaunch: (d) => launched.push(d),
  });
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

async function postBookmark(path: string): Promise<Bookmark> {
  const res = await app.request('/api/bookmarks', {
    method: 'POST',
    headers: AUTH,
    body: JSON.stringify({ path }),
  });
  return ((await res.json()) as { bookmark: Bookmark }).bookmark;
}

describe('data API', () => {
  it('GET /api/fs returns a listing', async () => {
    const res = await app.request('/api/fs?path=~/Developer', { headers: AUTH });
    expect(res.status).toBe(200);
    const body = (await res.json()) as DirListing;
    expect(body.entries[0]!.name).toBe('code-starter');
    expect(body.entries[0]!.usedWithClaude).toBe(true);
  });

  it('bookmarks: add, list, reorder, delete', async () => {
    const a = await postBookmark('/p/a');
    const b = await postBookmark('/p/b');
    expect(a.label).toBe('a');

    const reordered = await app.request('/api/bookmarks/reorder', {
      method: 'PATCH',
      headers: AUTH,
      body: JSON.stringify({ ids: [b.id, a.id] }),
    });
    const body = (await reordered.json()) as { bookmarks: Bookmark[] };
    expect(body.bookmarks.map((x) => x.path)).toEqual(['/p/b', '/p/a']);

    const del = await app.request(`/api/bookmarks/${a.id}`, { method: 'DELETE', headers: AUTH });
    expect(del.status).toBe(204);

    const list = (await (await app.request('/api/bookmarks', { headers: AUTH })).json()) as {
      bookmarks: Bookmark[];
    };
    expect(list.bookmarks).toHaveLength(1);
  });

  it('POST /api/fs/mkdir creates a folder', async () => {
    const res = await app.request('/api/fs/mkdir', {
      method: 'POST',
      headers: AUTH,
      body: JSON.stringify({ path: '/Users/x/Developer', name: 'newproj' }),
    });
    expect(res.status).toBe(201);
    expect(((await res.json()) as { path: string }).path).toBe('/Users/x/Developer/newproj');
  });

  it('GET /api/recent returns recent dirs', async () => {
    const res = await app.request('/api/recent', { headers: AUTH });
    const body = (await res.json()) as { recent: RecentDir[] };
    expect(body.recent[0]!.path).toBe('/Users/x/Developer/code-starter');
  });

  it('records launch history via onLaunch when a session is created', async () => {
    await app.request('/api/sessions', {
      method: 'POST',
      headers: AUTH,
      body: JSON.stringify({ dir: '/p/x', name: 'x' }),
    });
    expect(launched).toEqual(['/p/x']);
  });
});
