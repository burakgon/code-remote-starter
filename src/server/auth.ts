import type { MiddlewareHandler } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';

const COOKIE = 'crs_token';

export function authMiddleware(token: string): MiddlewareHandler {
  return async (c, next) => {
    // CSRF guard: for state-changing methods, reject mismatched Origin.
    if (c.req.method !== 'GET' && c.req.method !== 'HEAD') {
      const origin = c.req.header('Origin');
      if (origin) {
        const host = c.req.header('Host');
        let originHost = '';
        try {
          originHost = new URL(origin).host;
        } catch {
          originHost = origin;
        }
        if (host && originHost !== host) return c.json({ error: 'origin mismatch' }, 403);
      }
    }

    const cookie = getCookie(c, COOKIE);
    if (cookie === token) return next();

    const query = c.req.query('token');
    if (query === token) {
      setCookie(c, COOKIE, token, {
        httpOnly: true,
        sameSite: 'Strict',
        path: '/',
        maxAge: 60 * 60 * 24 * 365,
      });
      return next();
    }

    return c.json({ error: 'unauthorized' }, 401);
  };
}
