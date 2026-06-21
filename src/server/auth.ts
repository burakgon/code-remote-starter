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
        maxAge: 60 * 60 * 24 * 400, // 400 days = the cookie maximum; the token is also
        // kept on-device in localStorage, so sign-in effectively never expires.
      });
      return next();
    }

    if (c.req.path.startsWith('/api')) return c.json({ error: 'unauthorized' }, 401);
    return c.html(tokenPage(), 401);
  };
}

/** Minimal page shown to an unauthenticated browser, prompting for the token. */
function tokenPage(): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="color-scheme" content="dark"/><title>Code Remote Starter</title>
<style>
:root{color-scheme:dark}*{box-sizing:border-box}
body{margin:0;min-height:100dvh;display:flex;align-items:center;justify-content:center;background:#0b0c0e;color:#e6e7e9;font-family:-apple-system,BlinkMacSystemFont,system-ui,sans-serif;padding:24px}
.card{width:100%;max-width:340px}
.logo{width:26px;height:26px;border-radius:8px;background:linear-gradient(135deg,#e08a6b,#c2543a);margin-bottom:18px}
h1{font-size:17px;margin:0 0 6px}
p{font-size:13px;color:#7b7d82;margin:0 0 18px;line-height:1.5}
input{width:100%;padding:12px 13px;border-radius:11px;border:1px solid #26272b;background:#141518;color:#e6e7e9;font-family:ui-monospace,monospace;font-size:13px;outline:none}
input:focus{border-color:#e08a6b}
button{width:100%;margin-top:10px;padding:12px;border:0;border-radius:11px;font-weight:700;font-size:14px;color:#1a0f0a;background:linear-gradient(135deg,#e08a6b,#c2543a);cursor:pointer}
</style></head>
<body><form class="card" onsubmit="event.preventDefault();var t=document.getElementById('t').value.trim();if(t)location.href='/?token='+encodeURIComponent(t)">
<div class="logo"></div>
<h1>Enter access token</h1>
<p>Paste the token from the URL printed when you started Code Remote Starter on your Mac.</p>
<input id="t" autofocus autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="access token"/>
<button type="submit">Continue</button>
</form></body></html>`;
}
