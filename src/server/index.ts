import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { WebSocketServer } from 'ws';
import type { IncomingMessage, Server } from 'node:http';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
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

export function main(argv = process.argv.slice(2)): void {
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

  // Serve the built SPA (when present) behind the same auth + port.
  const webDir = fileURLToPath(new URL('../../dist/web', import.meta.url));
  if (existsSync(webDir)) {
    const indexHtml = readFileSync(join(webDir, 'index.html'), 'utf8');
    api.use('/assets/*', serveStatic({ root: 'dist/web' }));
    api.get('*', (c) => c.html(indexHtml));
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

  const url = accessUrl(host, port, config.token);
  console.log(`\n  Code Remote Starter is listening on ${host}:${port}`);
  console.log(`  Open from this machine or your phone (same network / Tailscale):\n`);
  console.log(`    ${url}\n`);
  console.log(`  The token in that URL is the only thing protecting a permissionless`);
  console.log(`  Claude. Keep it private; reach the app over a trusted network.\n`);

  if (cli.open) {
    execFile('open', [accessUrl('localhost', port, config.token)]);
  }
}

const isMain = (() => {
  try {
    return !!process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
})();
if (isMain) main();
