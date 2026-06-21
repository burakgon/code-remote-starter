import { serve } from '@hono/node-server';
import { WebSocketServer } from 'ws';
import type { IncomingMessage, Server } from 'node:http';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { networkInterfaces } from 'node:os';
import QRCode from 'qrcode';
import { getConfigDir, loadConfig, saveConfig, recordLaunch } from './config.ts';
import { createTmux } from './tmux.ts';
import { SessionManager } from './sessions.ts';
import { createApi } from './api.ts';
import { SessionBroadcaster } from './ws.ts';
import { BookmarkStore } from './bookmarks.ts';
import { listDirectory } from './fs.ts';
import { recentDirectories } from './recent.ts';

export interface CliArgs {
  port?: number;
  host?: string;
  command?: string;
  open?: boolean;
}

export function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--port') args.port = Number(argv[++i]);
    else if (a === '--host') args.host = argv[++i];
    else if (a === '--command') args.command = argv[++i];
    else if (a === '--open') args.open = true;
  }
  return args;
}

export function accessUrl(host: string, port: number, token: string): string {
  const h = host === '0.0.0.0' || host === '::' ? 'localhost' : host;
  return `http://${h}:${port}/?token=${token}`;
}

/** First non-internal IPv4 address, preferring private LAN ranges. */
export function lanAddress(): string | null {
  const candidates: string[] = [];
  for (const ifaces of Object.values(networkInterfaces())) {
    for (const net of ifaces ?? []) {
      if (net.family === 'IPv4' && !net.internal) candidates.push(net.address);
    }
  }
  const priv = candidates.find((a) => /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a));
  return priv ?? candidates[0] ?? null;
}

function tokenFromReq(req: IncomingMessage): string | undefined {
  const raw = req.headers.cookie ?? '';
  for (const part of raw.split(';')) {
    const [k, v] = part.trim().split('=');
    if (k === 'crs_token') return v;
  }
  try {
    const q = new URL(req.url ?? '', 'http://localhost').searchParams.get('token');
    if (q) return q;
  } catch {
    // ignore malformed URL
  }
  return undefined;
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const cli = parseArgs(argv);
  const configDir = getConfigDir();
  const config = loadConfig(configDir);
  if (cli.command) config.baseCommand = cli.command;
  const port = cli.port ?? config.port;
  const host = cli.host ?? config.host;
  saveConfig(config, configDir);

  const sessions = new SessionManager({ tmux: createTmux(), baseCommand: config.baseCommand });
  const broadcaster = new SessionBroadcaster(sessions);
  const bookmarks = new BookmarkStore({ dir: configDir });
  const api = createApi({
    token: config.token,
    sessions,
    bookmarks,
    baseCommand: config.baseCommand,
    listDir: (path) => listDirectory(path),
    getRecent: () => recentDirectories({ launchHistory: config.launchHistory }),
    onLaunch: (dir) => {
      recordLaunch(config, dir);
      saveConfig(config, configDir);
    },
  });

  // Serve the built SPA (when present) behind the same auth + port. Paths resolve
  // relative to this file, so it works from any cwd (dev, built, or installed).
  const webDir = fileURLToPath(new URL('../../dist/web', import.meta.url));
  if (existsSync(join(webDir, 'index.html'))) {
    const indexHtml = readFileSync(join(webDir, 'index.html'), 'utf8');
    const contentType = (file: string): string => {
      if (file.endsWith('.js')) return 'text/javascript; charset=utf-8';
      if (file.endsWith('.css')) return 'text/css; charset=utf-8';
      if (file.endsWith('.png')) return 'image/png';
      if (file.endsWith('.svg')) return 'image/svg+xml';
      if (file.endsWith('.ico')) return 'image/x-icon';
      if (file.endsWith('.webmanifest') || file.endsWith('.json'))
        return 'application/manifest+json';
      return 'application/octet-stream';
    };
    api.get('/assets/*', (c) => {
      const file = join(webDir, c.req.path.replace(/^\/+/, ''));
      if (!file.startsWith(webDir) || !existsSync(file)) return c.notFound();
      return new Response(new Uint8Array(readFileSync(file)), {
        headers: {
          'content-type': contentType(file),
          'cache-control': 'public, max-age=31536000, immutable',
        },
      });
    });
    // Serve other built files at the root (manifest, icons, favicon); fall back to the SPA.
    api.get('*', (c) => {
      const rel = c.req.path.replace(/^\/+/, '');
      const file = join(webDir, rel);
      if (rel && file.startsWith(webDir) && existsSync(file) && statSync(file).isFile()) {
        return new Response(new Uint8Array(readFileSync(file)), {
          headers: { 'content-type': contentType(file), 'cache-control': 'public, max-age=3600' },
        });
      }
      return c.html(indexHtml);
    });
  }

  const server = serve({ fetch: api.fetch, port, hostname: host }) as unknown as Server;

  const wss = new WebSocketServer({ noServer: true });
  server.on('upgrade', (req, socket, head) => {
    if (tokenFromReq(req) !== config.token) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      broadcaster.add(ws);
      ws.on('close', () => broadcaster.remove(ws));
    });
  });

  setInterval(() => {
    void sessions.refresh();
  }, 2000);

  const localUrl = accessUrl('localhost', port, config.token);
  const exposed = host === '0.0.0.0' || host === '::';
  const lan = exposed ? lanAddress() : null;
  const phoneUrl = lan ? `http://${lan}:${port}/?token=${config.token}` : null;

  console.log(`\n  Code Remote Starter is listening on ${host}:${port}\n`);
  console.log(`  On this Mac:\n    ${localUrl}\n`);
  if (phoneUrl) {
    console.log(`  On your phone (same Wi-Fi / Tailscale) — scan the QR or open the URL:`);
    console.log(`    ${phoneUrl}\n`);
    try {
      console.log(await QRCode.toString(phoneUrl, { type: 'terminal', small: true }));
    } catch {
      // QR rendering is best-effort.
    }
  }
  console.log(`  The token is the only thing protecting a permissionless Claude.`);
  console.log(`  Keep it private; reach the app over a trusted network.\n`);

  if (cli.open) execFile('open', [localUrl]);
}

const isMain = (() => {
  try {
    return !!process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
})();
if (isMain) main();
