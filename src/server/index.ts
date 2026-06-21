import { serve } from '@hono/node-server';
import { WebSocketServer } from 'ws';
import type { IncomingMessage, Server } from 'node:http';
import { fileURLToPath } from 'node:url';
import { realpathSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { loadConfig, saveConfig } from './config.ts';
import { createTmux } from './tmux.ts';
import { SessionManager } from './sessions.ts';
import { createApi } from './api.ts';
import { SessionBroadcaster } from './ws.ts';

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

function tokenFromCookie(req: IncomingMessage): string | undefined {
  const raw = req.headers.cookie ?? '';
  for (const part of raw.split(';')) {
    const [k, v] = part.trim().split('=');
    if (k === 'crs_token') return v;
  }
  return undefined;
}

export function main(argv = process.argv.slice(2)): void {
  const cli = parseArgs(argv);
  const config = loadConfig();
  if (cli.command) config.baseCommand = cli.command;
  const port = cli.port ?? config.port;
  const host = cli.host ?? config.host;
  saveConfig(config);

  const sessions = new SessionManager({ tmux: createTmux(), baseCommand: config.baseCommand });
  const broadcaster = new SessionBroadcaster(sessions);
  const api = createApi({ sessions, token: config.token });

  const server = serve({ fetch: api.fetch, port, hostname: host }) as unknown as Server;

  const wss = new WebSocketServer({ noServer: true });
  server.on('upgrade', (req, socket, head) => {
    if (tokenFromCookie(req) !== config.token) {
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
