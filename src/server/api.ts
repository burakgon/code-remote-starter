import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware } from './auth.ts';
import type { SessionManager } from './sessions.ts';

const createSchema = z.object({ dir: z.string().min(1), name: z.string().min(1) });
const renameSchema = z.object({ name: z.string().min(1) });

export function createApi(deps: { sessions: SessionManager; token: string }): Hono {
  const app = new Hono();
  app.use('/api/*', authMiddleware(deps.token));

  app.get('/api/sessions', (c) => c.json({ sessions: deps.sessions.list() }));

  app.post('/api/sessions', async (c) => {
    const parsed = createSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'invalid body' }, 400);
    const session = await deps.sessions.create(parsed.data);
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

  return app;
}
