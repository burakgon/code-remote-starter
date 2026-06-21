import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { authMiddleware } from './auth.ts';
import { LoginThrottle } from './throttle.ts';

const TOKEN = 'a'.repeat(64);
function app() {
  const a = new Hono();
  a.use('*', authMiddleware(TOKEN));
  a.get('/api/ping', (c) => c.json({ ok: true }));
  a.post('/api/do', (c) => c.json({ done: true }));
  return a;
}

describe('authMiddleware', () => {
  it('rejects requests with no token', async () => {
    const res = await app().request('/api/ping');
    expect(res.status).toBe(401);
  });

  it('accepts a valid ?token= and sets a cookie', async () => {
    const res = await app().request(`/api/ping?token=${TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('set-cookie')).toContain('crs_token=');
    expect(res.headers.get('set-cookie')?.toLowerCase()).toContain('httponly');
  });

  it('accepts a valid cookie', async () => {
    const res = await app().request('/api/ping', { headers: { Cookie: `crs_token=${TOKEN}` } });
    expect(res.status).toBe(200);
  });

  it('rejects a wrong token', async () => {
    const res = await app().request('/api/ping?token=wrong');
    expect(res.status).toBe(401);
  });

  it('rejects cross-origin POST (CSRF guard)', async () => {
    const res = await app().request('/api/do', {
      method: 'POST',
      headers: { Cookie: `crs_token=${TOKEN}`, Origin: 'http://evil.example', Host: 'localhost' },
    });
    expect(res.status).toBe(403);
  });

  it('serves an HTML token page for unauthorized non-API requests', async () => {
    const a = new Hono();
    a.use('*', authMiddleware(TOKEN));
    a.get('/', (c) => c.text('home'));
    const res = await a.request('/');
    expect(res.status).toBe(401);
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(await res.text()).toContain('access token');
  });

  it('locks an IP after more than 5 wrong-token attempts (429)', async () => {
    const throttle = new LoginThrottle();
    const a = new Hono();
    a.use('*', authMiddleware(TOKEN, { throttle, getIp: () => '9.9.9.9' }));
    a.get('/api/ping', (c) => c.json({ ok: true }));

    for (let i = 0; i < 5; i++) {
      expect((await a.request('/api/ping?token=bad')).status).toBe(401);
    }
    // 6th wrong attempt locks the IP
    expect((await a.request('/api/ping?token=bad')).status).toBe(429);
    // even the correct token is refused while locked
    expect((await a.request(`/api/ping?token=${TOKEN}`)).status).toBe(429);
  });

  it('does not count a missing token toward the lock', async () => {
    const throttle = new LoginThrottle();
    const a = new Hono();
    a.use('*', authMiddleware(TOKEN, { throttle, getIp: () => '8.8.8.8' }));
    a.get('/api/ping', (c) => c.json({ ok: true }));

    for (let i = 0; i < 10; i++) {
      expect((await a.request('/api/ping')).status).toBe(401);
    }
    // never supplied a wrong token, so a correct one still works
    expect((await a.request(`/api/ping?token=${TOKEN}`)).status).toBe(200);
  });
});
