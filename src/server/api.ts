import { homedir } from 'node:os';
import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware } from './auth.ts';
import type { SessionManager } from './sessions.ts';
import type { BookmarkStore } from './bookmarks.ts';
import type { DirListing } from './fs.ts';
import type { RecentDir } from './recent.ts';

const createSchema = z.object({ dir: z.string().min(1), name: z.string().min(1) });
const renameSchema = z.object({ name: z.string().min(1) });
const bookmarkSchema = z.object({ path: z.string().min(1), label: z.string().optional() });
const reorderSchema = z.object({ ids: z.array(z.string()) });

export interface ApiDeps {
  token: string;
  sessions: SessionManager;
  bookmarks?: BookmarkStore;
  listDir?: (path: string) => DirListing;
  getRecent?: () => RecentDir[];
  onLaunch?: (dir: string) => void;
  baseCommand?: string;
}

export function createApi(deps: ApiDeps): Hono {
  const app = new Hono();
  app.use('*', authMiddleware(deps.token));

  app.get('/api/meta', (c) => c.json({ baseCommand: deps.baseCommand ?? '', home: homedir() }));

  app.get('/api/sessions', (c) => c.json({ sessions: deps.sessions.list() }));

  app.post('/api/sessions', async (c) => {
    const parsed = createSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'invalid body' }, 400);
    const session = await deps.sessions.create(parsed.data);
    deps.onLaunch?.(parsed.data.dir);
    return c.json({ session }, 201);
  });

  app.delete('/api/sessions/:id', async (c) => {
    try {
      await deps.sessions.stop(c.req.param('id'));
    } catch {
      return c.json({ error: 'not found' }, 404);
    }
    return c.body(null, 204);
  });

  app.patch('/api/sessions/:id', async (c) => {
    const parsed = renameSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'invalid body' }, 400);
    try {
      const session = deps.sessions.rename(c.req.param('id'), parsed.data.name);
      return c.json({ session });
    } catch {
      return c.json({ error: 'not found' }, 404);
    }
  });

  if (deps.listDir) {
    const listDir = deps.listDir;
    app.get('/api/fs', (c) => {
      try {
        return c.json(listDir(c.req.query('path') ?? '~'));
      } catch (err) {
        return c.json({ error: err instanceof Error ? err.message : 'cannot read directory' }, 400);
      }
    });
  }

  if (deps.bookmarks) {
    const store = deps.bookmarks;
    app.get('/api/bookmarks', (c) => c.json({ bookmarks: store.list() }));
    app.post('/api/bookmarks', async (c) => {
      const parsed = bookmarkSchema.safeParse(await c.req.json().catch(() => null));
      if (!parsed.success) return c.json({ error: 'invalid body' }, 400);
      return c.json({ bookmark: store.add(parsed.data) }, 201);
    });
    app.patch('/api/bookmarks/reorder', async (c) => {
      const parsed = reorderSchema.safeParse(await c.req.json().catch(() => null));
      if (!parsed.success) return c.json({ error: 'invalid body' }, 400);
      store.reorder(parsed.data.ids);
      return c.json({ bookmarks: store.list() });
    });
    app.delete('/api/bookmarks/:id', (c) => {
      store.remove(c.req.param('id'));
      return c.body(null, 204);
    });
  }

  if (deps.getRecent) {
    const getRecent = deps.getRecent;
    app.get('/api/recent', (c) => c.json({ recent: getRecent() }));
  }

  return app;
}
