# Code Remote Starter — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a phone-reachable web app that runs on the Mac and launches Claude Code (`cym`) sessions in any chosen directory, with a touch-first directory picker, bookmarks, and a live session manager.

**Architecture:** A single Node + TypeScript process serves a React/Vite/Tailwind SPA, a token-gated HTTP API (Hono), and a WebSocket on one port. Sessions run in detached `tmux` sessions so they persist independently of the browser and the server. Remote Control auto-enables (the user's `remoteControlAtStartup` is already `true`), so launched sessions appear in the Claude mobile app.

**Tech Stack:** Node + TypeScript (ESM, native type-stripping; `tsx` for dev) · Hono + `@hono/node-server` · `ws` · `zod` · Vitest · React 19 + Vite + Tailwind CSS v4 + TanStack Query + `wouter` + `lucide-react` · ESLint + Prettier · GitHub Actions · MIT.

**Spec:** `docs/superpowers/specs/2026-06-22-code-remote-starter-design.md`

## Global Constraints

- **Platform:** macOS-first. Requires `tmux` (3.6b present) and `claude` on PATH. Node ≥ 20 (dev/CI); the author's machine runs Node 25.
- **Auth is mandatory:** every HTTP request and WebSocket upgrade requires a valid token. The app spawns `claude --dangerously-skip-permissions`, so there is no unauthenticated surface.
- **Default base command** = the `cym` expansion: `claude --dangerously-skip-permissions --effort max`. Configurable via `config.json` / `--command`.
- **tmux session name prefix:** `crs-`. Internal id is a short hex string; tmux name = `crs-<id>`.
- **Config dir:** `~/.config/code-remote-starter/` (override with `CRS_CONFIG_DIR`). All config files written with mode `0600`.
- **Defaults:** `port = 4317`, `host = 0.0.0.0`.
- **Copy/UI:** English only. **No emoji anywhere.** Dark "Direction A" palette (see spec §9).
- **License:** MIT. Project is public/open-source.
- **Discipline:** DRY, YAGNI, TDD, frequent commits. Co-locate `*.test.ts` with source.

---

## Phase Roadmap

This plan fully details **Phase 1**. Phases 2–5 are scoped here and each gets its own detailed plan after the previous phase is validated (kept as separate plans so each stays complete and shippable).

- **Phase 1 — Walking skeleton + backend core** *(this plan)*: validate detached-tmux Remote Control; config/token; tmux session manager; auth; sessions HTTP API; WebSocket status; CLI entry. Deliverable: a token-gated backend you can `curl` to launch/list/stop real sessions.
- **Phase 2 — Data APIs**: `GET /api/fs` (directory listing + `isGitRepo` / `usedWithClaude` / `childDirCount`), bookmarks CRUD, recent-directories service (transcript `cwd` extraction + launch history).
- **Phase 3 — Frontend shell**: Vite + Tailwind app, token/auth handling, Home + running list, live WS updates, design tokens.
- **Phase 4 — Picker + launch**: Browse/Bookmarks/Recent tabs, breadcrumb, filter/paste-path, indicators, Confirm sheet, launch; session stop/rename, toasts, errors, empty states.
- **Phase 5 — Responsive/a11y polish + release**: phone/foldable/desktop layouts, keyboard, README + screenshots, tests, CI, MIT.

---

## Phase 1 File Structure

- Create: `package.json` — package manifest, scripts, deps.
- Create: `tsconfig.json` — TypeScript config (ESM, strict).
- Create: `vitest.config.ts` — test runner config.
- Create: `src/server/types.ts` — shared types (`Session`, `AppConfig`).
- Create: `src/server/config.ts` — config dir, load/save, token generation.
- Create: `src/server/command.ts` — build the session shell command (base command + remote-control + quoted name).
- Create: `src/server/tmux.ts` — thin, injectable tmux wrapper (`Tmux` interface + real impl).
- Create: `src/server/sessions.ts` — `SessionManager` (create/list/stop/rename/refresh + change events).
- Create: `src/server/auth.ts` — token-gate Hono middleware.
- Create: `src/server/api.ts` — Hono app with `/api/sessions` routes.
- Create: `src/server/ws.ts` — session broadcaster (serialize + push to clients).
- Create: `src/server/index.ts` — CLI + compose Hono/node-server/ws + poll loop.
- Test: co-located `src/server/*.test.ts`.

---

## Task 0: Walking skeleton — validate detached-tmux Remote Control (manual)

**This is a prerequisite gate, not a code task.** It confirms the riskiest assumption and fixes the exact launch flags before we hard-code them. Do this with the user's Mac + phone.

- [ ] **Step 1: Launch a real session in a detached tmux session**

Run (in a throwaway directory, e.g. the repo itself):
```bash
tmux new-session -d -s crs-test -c "$HOME/Developer/code-starter" \
  "claude --dangerously-skip-permissions --effort max --remote-control 'crs-test'"
tmux ls
```
Expected: `tmux ls` lists `crs-test`. The process is running detached (no client attached).

- [ ] **Step 2: Confirm it appears on the phone and is drivable**

On the phone, open the Claude app's Remote Control list. Expected: a session named `crs-test` (or hostname-prefixed) appears, can be opened, accepts a prompt, and responds — all without anyone attached to the terminal on the Mac.

- [ ] **Step 3: Record the outcome**

If it works with `--remote-control '<name>'`: keep that flag (the plan assumes it). If the session does NOT appear or errors, retry without `--remote-control` (relying on `remoteControlAtStartup: true`) and with `-n '<name>'` for the display name; note which combination registers and is drivable. Write the working command into `config.json`'s `baseCommand` expectation and adjust `command.ts` (Task 3) accordingly.

- [ ] **Step 4: Tear down**

```bash
tmux kill-session -t crs-test
```
Expected: `tmux ls` no longer lists `crs-test`.

> **Gate:** Do not proceed to Task 1 until a detached-tmux session is confirmed drivable from the phone and the exact flag set is recorded.

---

## Task 1: Project scaffold + config & token

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`
- Create: `src/server/types.ts`
- Create: `src/server/config.ts`
- Test: `src/server/config.test.ts`

**Interfaces:**
- Produces:
  - `interface AppConfig { token: string; port: number; host: string; baseCommand: string; launchHistory: LaunchHistoryEntry[] }`
  - `interface LaunchHistoryEntry { path: string; lastLaunchedAt: number; count: number }`
  - `getConfigDir(): string`
  - `loadConfig(dir?: string): AppConfig` — creates the dir (0700) and a default config with a fresh token if absent.
  - `saveConfig(config: AppConfig, dir?: string): void` — writes `config.json` with mode 0600.
  - `generateToken(): string` — 32 random bytes hex.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "code-remote-starter",
  "version": "0.1.0",
  "description": "Start Claude Code sessions in any directory, from your phone.",
  "type": "module",
  "license": "MIT",
  "bin": { "code-remote-starter": "dist/server/index.js", "crs": "dist/server/index.js" },
  "scripts": {
    "dev:server": "tsx watch src/server/index.ts",
    "start": "tsx src/server/index.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "lint": "eslint ."
  },
  "dependencies": {
    "@hono/node-server": "^1.13.0",
    "hono": "^4.6.0",
    "ws": "^8.18.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/ws": "^8.5.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2023"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "types": ["node"]
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: Install dependencies**

Run: `npm install`
Expected: `node_modules/` created, no errors.

- [ ] **Step 5: Create `src/server/types.ts`**

```ts
export type SessionStatus = 'running' | 'ended';

export interface Session {
  id: string;
  name: string;
  dir: string;
  tmuxName: string;
  startedAt: number;
  status: SessionStatus;
}

export interface LaunchHistoryEntry {
  path: string;
  lastLaunchedAt: number;
  count: number;
}

export interface AppConfig {
  token: string;
  port: number;
  host: string;
  baseCommand: string;
  launchHistory: LaunchHistoryEntry[];
}
```

- [ ] **Step 6: Write the failing test for config**

`src/server/config.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, statSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig, saveConfig, generateToken } from './config.ts';

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'crs-cfg-')); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

describe('config', () => {
  it('generateToken returns 64 hex chars', () => {
    expect(generateToken()).toMatch(/^[0-9a-f]{64}$/);
  });

  it('loadConfig creates a default config with a token when none exists', () => {
    const cfg = loadConfig(dir);
    expect(cfg.token).toMatch(/^[0-9a-f]{64}$/);
    expect(cfg.port).toBe(4317);
    expect(cfg.host).toBe('0.0.0.0');
    expect(cfg.baseCommand).toBe('claude --dangerously-skip-permissions --effort max');
    expect(cfg.launchHistory).toEqual([]);
    expect(existsSync(join(dir, 'config.json'))).toBe(true);
  });

  it('writes config.json with 0600 permissions', () => {
    loadConfig(dir);
    const mode = statSync(join(dir, 'config.json')).mode & 0o777;
    expect(mode).toBe(0o600);
  });

  it('loadConfig returns the same token on a second call (persisted)', () => {
    const first = loadConfig(dir).token;
    const second = loadConfig(dir).token;
    expect(second).toBe(first);
  });

  it('saveConfig round-trips changes', () => {
    const cfg = loadConfig(dir);
    cfg.port = 5000;
    saveConfig(cfg, dir);
    expect(JSON.parse(readFileSync(join(dir, 'config.json'), 'utf8')).port).toBe(5000);
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `npm test -- config`
Expected: FAIL — `config.ts` has no exports / module not found.

- [ ] **Step 8: Implement `src/server/config.ts`**

```ts
import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { AppConfig } from './types.ts';

export function getConfigDir(): string {
  return process.env.CRS_CONFIG_DIR ?? join(homedir(), '.config', 'code-remote-starter');
}

export function generateToken(): string {
  return randomBytes(32).toString('hex');
}

function defaultConfig(): AppConfig {
  return {
    token: generateToken(),
    port: 4317,
    host: '0.0.0.0',
    baseCommand: 'claude --dangerously-skip-permissions --effort max',
    launchHistory: [],
  };
}

export function loadConfig(dir: string = getConfigDir()): AppConfig {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const file = join(dir, 'config.json');
  if (!existsSync(file)) {
    const cfg = defaultConfig();
    saveConfig(cfg, dir);
    return cfg;
  }
  const loaded = JSON.parse(readFileSync(file, 'utf8')) as Partial<AppConfig>;
  return { ...defaultConfig(), ...loaded, token: loaded.token ?? generateToken() };
}

export function saveConfig(config: AppConfig, dir: string = getConfigDir()): void {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  writeFileSync(join(dir, 'config.json'), JSON.stringify(config, null, 2), { mode: 0o600 });
}
```

- [ ] **Step 9: Run test to verify it passes**

Run: `npm test -- config`
Expected: PASS (5 tests).

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json tsconfig.json vitest.config.ts src/server/types.ts src/server/config.ts src/server/config.test.ts
git commit -m "feat: project scaffold + config & token store"
```

---

## Task 2: Launch command builder

**Files:**
- Create: `src/server/command.ts`
- Test: `src/server/command.test.ts`

**Interfaces:**
- Consumes: `AppConfig.baseCommand` (string).
- Produces: `buildSessionCommand(baseCommand: string, name: string): string` — returns a shell command string appending `--remote-control '<name>'` with the name safely single-quoted.

> Flag set assumed from Task 0. If Task 0 found `--remote-control` conflicts with `remoteControlAtStartup`, replace `--remote-control` with `-n` in the implementation below; the tests change only in the expected substring.

- [ ] **Step 1: Write the failing test**

`src/server/command.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { buildSessionCommand } from './command.ts';

const BASE = 'claude --dangerously-skip-permissions --effort max';

describe('buildSessionCommand', () => {
  it('appends a single-quoted remote-control name', () => {
    expect(buildSessionCommand(BASE, 'code-starter'))
      .toBe(`${BASE} --remote-control 'code-starter'`);
  });

  it('escapes single quotes in the name', () => {
    expect(buildSessionCommand(BASE, "my'proj"))
      .toBe(`${BASE} --remote-control 'my'\\''proj'`);
  });

  it('handles names with spaces', () => {
    expect(buildSessionCommand(BASE, 'hello world'))
      .toBe(`${BASE} --remote-control 'hello world'`);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- command`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/server/command.ts`**

```ts
function singleQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export function buildSessionCommand(baseCommand: string, name: string): string {
  return `${baseCommand} --remote-control ${singleQuote(name)}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- command`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/server/command.ts src/server/command.test.ts
git commit -m "feat: session launch command builder"
```

---

## Task 3: tmux wrapper + SessionManager

**Files:**
- Create: `src/server/tmux.ts`
- Create: `src/server/sessions.ts`
- Test: `src/server/sessions.test.ts`

**Interfaces:**
- Consumes: `buildSessionCommand` (Task 2); `Session` (Task 1).
- Produces:
  - `interface Tmux { newSession(name, dir, command): Promise<void>; listSessionNames(): Promise<string[]>; killSession(name): Promise<void>; renameSession(oldName, newName): Promise<void> }`
  - `createTmux(): Tmux` — real implementation shelling out via `execFile`.
  - `class SessionManager` with: `constructor(opts: { tmux: Tmux; baseCommand: string; idFactory?: () => string; now?: () => number })`, `list(): Session[]`, `create(input: { dir: string; name: string }): Promise<Session>`, `stop(id: string): Promise<void>`, `rename(id: string, name: string): Session`, `refresh(): Promise<boolean>` (returns whether anything changed), `onChange(cb: (sessions: Session[]) => void): () => void`.

- [ ] **Step 1: Write the failing test (uses a fake Tmux)**

`src/server/sessions.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { SessionManager } from './sessions.ts';
import type { Tmux } from './tmux.ts';

class FakeTmux implements Tmux {
  live = new Set<string>();
  commands: { name: string; dir: string; command: string }[] = [];
  async newSession(name: string, dir: string, command: string) {
    this.live.add(name);
    this.commands.push({ name, dir, command });
  }
  async listSessionNames() { return [...this.live]; }
  async killSession(name: string) { this.live.delete(name); }
  async renameSession(oldName: string, newName: string) {
    this.live.delete(oldName); this.live.add(newName);
  }
}

const BASE = 'claude --dangerously-skip-permissions --effort max';
let tmux: FakeTmux;
let ids: string[];
function manager() {
  ids = ['aaaa', 'bbbb', 'cccc'];
  return new SessionManager({ tmux, baseCommand: BASE, idFactory: () => ids.shift()!, now: () => 1000 });
}
beforeEach(() => { tmux = new FakeTmux(); });

describe('SessionManager', () => {
  it('create launches a tmux session with the built command and tracks it', async () => {
    const m = manager();
    const s = await m.create({ dir: '/p/code-starter', name: 'code-starter' });
    expect(s.tmuxName).toBe('crs-aaaa');
    expect(s.status).toBe('running');
    expect(s.startedAt).toBe(1000);
    expect(tmux.live.has('crs-aaaa')).toBe(true);
    expect(tmux.commands[0]!.command).toBe(`${BASE} --remote-control 'code-starter'`);
    expect(tmux.commands[0]!.dir).toBe('/p/code-starter');
    expect(m.list()).toHaveLength(1);
  });

  it('stop kills the tmux session and marks it ended', async () => {
    const m = manager();
    const s = await m.create({ dir: '/p/a', name: 'a' });
    await m.stop(s.id);
    expect(tmux.live.has(s.tmuxName)).toBe(false);
    expect(m.list().find((x) => x.id === s.id)!.status).toBe('ended');
  });

  it('rename updates the display name', async () => {
    const m = manager();
    const s = await m.create({ dir: '/p/a', name: 'a' });
    const renamed = m.rename(s.id, 'b');
    expect(renamed.name).toBe('b');
    expect(m.list()[0]!.name).toBe('b');
  });

  it('refresh marks sessions ended when tmux no longer lists them', async () => {
    const m = manager();
    const s = await m.create({ dir: '/p/a', name: 'a' });
    tmux.live.delete(s.tmuxName); // session died outside our control
    const changed = await m.refresh();
    expect(changed).toBe(true);
    expect(m.list()[0]!.status).toBe('ended');
  });

  it('onChange fires on create and stop', async () => {
    const m = manager();
    const events: number[] = [];
    m.onChange((sessions) => events.push(sessions.length));
    const s = await m.create({ dir: '/p/a', name: 'a' });
    await m.stop(s.id);
    expect(events.length).toBeGreaterThanOrEqual(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- sessions`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `src/server/tmux.ts`**

```ts
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

export interface Tmux {
  newSession(name: string, dir: string, command: string): Promise<void>;
  listSessionNames(): Promise<string[]>;
  killSession(name: string): Promise<void>;
  renameSession(oldName: string, newName: string): Promise<void>;
}

export function createTmux(): Tmux {
  return {
    async newSession(name, dir, command) {
      await run('tmux', ['new-session', '-d', '-s', name, '-c', dir, command]);
    },
    async listSessionNames() {
      try {
        const { stdout } = await run('tmux', ['list-sessions', '-F', '#{session_name}']);
        return stdout.split('\n').map((l) => l.trim()).filter(Boolean);
      } catch (err: unknown) {
        // tmux exits non-zero with "no server running" when there are no sessions.
        const msg = err instanceof Error ? err.message : String(err);
        if (/no server running|no such file/i.test(msg)) return [];
        throw err;
      }
    },
    async killSession(name) {
      await run('tmux', ['kill-session', '-t', name]);
    },
    async renameSession(oldName, newName) {
      await run('tmux', ['rename-session', '-t', oldName, newName]);
    },
  };
}
```

- [ ] **Step 4: Implement `src/server/sessions.ts`**

```ts
import { randomBytes } from 'node:crypto';
import type { Session } from './types.ts';
import type { Tmux } from './tmux.ts';
import { buildSessionCommand } from './command.ts';

export interface CreateSessionInput {
  dir: string;
  name: string;
}

interface SessionManagerOptions {
  tmux: Tmux;
  baseCommand: string;
  idFactory?: () => string;
  now?: () => number;
}

export class SessionManager {
  private readonly tmux: Tmux;
  private readonly baseCommand: string;
  private readonly idFactory: () => string;
  private readonly now: () => number;
  private readonly sessions = new Map<string, Session>();
  private readonly listeners = new Set<(sessions: Session[]) => void>();

  constructor(opts: SessionManagerOptions) {
    this.tmux = opts.tmux;
    this.baseCommand = opts.baseCommand;
    this.idFactory = opts.idFactory ?? (() => randomBytes(4).toString('hex'));
    this.now = opts.now ?? (() => Date.now());
  }

  list(): Session[] {
    return [...this.sessions.values()].sort((a, b) => b.startedAt - a.startedAt);
  }

  async create(input: CreateSessionInput): Promise<Session> {
    const id = this.idFactory();
    const tmuxName = `crs-${id}`;
    const command = buildSessionCommand(this.baseCommand, input.name);
    await this.tmux.newSession(tmuxName, input.dir, command);
    const session: Session = {
      id, name: input.name, dir: input.dir, tmuxName,
      startedAt: this.now(), status: 'running',
    };
    this.sessions.set(id, session);
    this.emit();
    return session;
  }

  async stop(id: string): Promise<void> {
    const session = this.sessions.get(id);
    if (!session) throw new Error(`Unknown session: ${id}`);
    if (session.status === 'running') {
      await this.tmux.killSession(session.tmuxName);
      session.status = 'ended';
      this.emit();
    }
  }

  rename(id: string, name: string): Session {
    const session = this.sessions.get(id);
    if (!session) throw new Error(`Unknown session: ${id}`);
    session.name = name;
    this.emit();
    return session;
  }

  async refresh(): Promise<boolean> {
    const live = new Set(await this.tmux.listSessionNames());
    let changed = false;
    for (const session of this.sessions.values()) {
      if (session.status === 'running' && !live.has(session.tmuxName)) {
        session.status = 'ended';
        changed = true;
      }
    }
    if (changed) this.emit();
    return changed;
  }

  onChange(cb: (sessions: Session[]) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private emit(): void {
    const snapshot = this.list();
    for (const cb of this.listeners) cb(snapshot);
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- sessions`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add src/server/tmux.ts src/server/sessions.ts src/server/sessions.test.ts
git commit -m "feat: tmux wrapper and SessionManager"
```

---

## Task 4: Auth middleware

**Files:**
- Create: `src/server/auth.ts`
- Test: `src/server/auth.test.ts`

**Interfaces:**
- Produces: `authMiddleware(token: string): MiddlewareHandler` (Hono). Accepts the request when the `crs_token` cookie matches; otherwise if `?token=` matches, sets the cookie (`httpOnly`, `SameSite=Strict`, `Path=/`) and continues; otherwise responds `401`. For non-GET requests, also rejects with `403` when an `Origin` header is present and its host differs from the request host (CSRF guard).

- [ ] **Step 1: Write the failing test**

`src/server/auth.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { authMiddleware } from './auth.ts';

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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- auth`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/server/auth.ts`**

```ts
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
        try { originHost = new URL(origin).host; } catch { originHost = origin; }
        if (host && originHost !== host) return c.json({ error: 'origin mismatch' }, 403);
      }
    }

    const cookie = getCookie(c, COOKIE);
    if (cookie === token) return next();

    const query = c.req.query('token');
    if (query === token) {
      setCookie(c, COOKIE, token, {
        httpOnly: true, sameSite: 'Strict', path: '/', maxAge: 60 * 60 * 24 * 365,
      });
      return next();
    }

    return c.json({ error: 'unauthorized' }, 401);
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- auth`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/server/auth.ts src/server/auth.test.ts
git commit -m "feat: token-gate auth middleware with CSRF guard"
```

---

## Task 5: Sessions HTTP API

**Files:**
- Create: `src/server/api.ts`
- Test: `src/server/api.test.ts`

**Interfaces:**
- Consumes: `SessionManager` (Task 3); `authMiddleware` (Task 4).
- Produces: `createApi(deps: { sessions: SessionManager; token: string }): Hono`. Routes (all behind auth):
  - `GET /api/sessions` → `200` `{ sessions: Session[] }`
  - `POST /api/sessions` body `{ dir: string; name: string }` → `201` `{ session: Session }`; `400` on invalid body
  - `DELETE /api/sessions/:id` → `204`; `404` if unknown
  - `PATCH /api/sessions/:id` body `{ name: string }` → `200` `{ session: Session }`; `404` if unknown

- [ ] **Step 1: Write the failing test (fake Tmux end-to-end through the API)**

`src/server/api.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createApi } from './api.ts';
import { SessionManager } from './sessions.ts';
import type { Tmux } from './tmux.ts';

const TOKEN = 'a'.repeat(64);
const AUTH = { Cookie: `crs_token=${TOKEN}`, 'Content-Type': 'application/json' };

class FakeTmux implements Tmux {
  live = new Set<string>();
  async newSession(name: string) { this.live.add(name); }
  async listSessionNames() { return [...this.live]; }
  async killSession(name: string) { this.live.delete(name); }
  async renameSession() {}
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
      method: 'POST', headers: AUTH,
      body: JSON.stringify({ dir: '/p/code-starter', name: 'code-starter' }),
    });
    expect(res.status).toBe(201);
    const { session } = await res.json();
    expect(session.name).toBe('code-starter');
    expect(session.status).toBe('running');
  });

  it('POST with invalid body returns 400', async () => {
    const res = await app.request('/api/sessions', {
      method: 'POST', headers: AUTH, body: JSON.stringify({ dir: '/p' }),
    });
    expect(res.status).toBe(400);
  });

  it('DELETE stops a session', async () => {
    const created = await (await app.request('/api/sessions', {
      method: 'POST', headers: AUTH, body: JSON.stringify({ dir: '/p/a', name: 'a' }),
    })).json();
    const res = await app.request(`/api/sessions/${created.session.id}`, { method: 'DELETE', headers: AUTH });
    expect(res.status).toBe(204);
    expect(sessions.list()[0]!.status).toBe('ended');
  });

  it('DELETE unknown id returns 404', async () => {
    const res = await app.request('/api/sessions/nope', { method: 'DELETE', headers: AUTH });
    expect(res.status).toBe(404);
  });

  it('PATCH renames a session', async () => {
    const created = await (await app.request('/api/sessions', {
      method: 'POST', headers: AUTH, body: JSON.stringify({ dir: '/p/a', name: 'a' }),
    })).json();
    const res = await app.request(`/api/sessions/${created.session.id}`, {
      method: 'PATCH', headers: AUTH, body: JSON.stringify({ name: 'b' }),
    });
    expect(res.status).toBe(200);
    expect((await res.json()).session.name).toBe('b');
  });

  it('requires auth', async () => {
    const res = await app.request('/api/sessions');
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- api`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/server/api.ts`**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- api`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/server/api.ts src/server/api.test.ts
git commit -m "feat: sessions HTTP API"
```

---

## Task 6: WebSocket session broadcaster

**Files:**
- Create: `src/server/ws.ts`
- Test: `src/server/ws.test.ts`

**Interfaces:**
- Consumes: `SessionManager` (Task 3); `Session` (Task 1).
- Produces: `class SessionBroadcaster` with `constructor(sessions: SessionManager)`, `add(client: WsClient): void` (sends a snapshot immediately, then pushes on every change), and `private serialize(): string`. `WsClient` is the minimal shape `{ send(data: string): void; readyState: number }` (compatible with `ws`'s `WebSocket`), so the broadcaster is testable with a fake socket. The wire message is `{ "type": "sessions", "sessions": Session[] }`.

- [ ] **Step 1: Write the failing test**

`src/server/ws.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { SessionBroadcaster } from './ws.ts';
import { SessionManager } from './sessions.ts';
import type { Tmux } from './tmux.ts';

class FakeTmux implements Tmux {
  live = new Set<string>();
  async newSession(name: string) { this.live.add(name); }
  async listSessionNames() { return [...this.live]; }
  async killSession(name: string) { this.live.delete(name); }
  async renameSession() {}
}

class FakeClient {
  readyState = 1; // OPEN
  messages: string[] = [];
  send(data: string) { this.messages.push(data); }
}

let sessions: SessionManager;
let broadcaster: SessionBroadcaster;
beforeEach(() => {
  sessions = new SessionManager({ tmux: new FakeTmux(), baseCommand: 'claude' });
  broadcaster = new SessionBroadcaster(sessions);
});

describe('SessionBroadcaster', () => {
  it('sends a snapshot to a newly added client', () => {
    const client = new FakeClient();
    broadcaster.add(client);
    expect(client.messages).toHaveLength(1);
    expect(JSON.parse(client.messages[0]!)).toEqual({ type: 'sessions', sessions: [] });
  });

  it('pushes updates to clients when sessions change', async () => {
    const client = new FakeClient();
    broadcaster.add(client);
    await sessions.create({ dir: '/p/a', name: 'a' });
    const last = JSON.parse(client.messages.at(-1)!);
    expect(last.type).toBe('sessions');
    expect(last.sessions).toHaveLength(1);
  });

  it('does not send to closed clients', async () => {
    const client = new FakeClient();
    broadcaster.add(client);
    client.readyState = 3; // CLOSED
    await sessions.create({ dir: '/p/a', name: 'a' });
    expect(client.messages).toHaveLength(1); // only the initial snapshot
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- ws`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/server/ws.ts`**

```ts
import type { SessionManager } from './sessions.ts';
import type { Session } from './types.ts';

export interface WsClient {
  send(data: string): void;
  readyState: number;
}

const OPEN = 1;

export class SessionBroadcaster {
  private readonly clients = new Set<WsClient>();

  constructor(private readonly sessions: SessionManager) {
    this.sessions.onChange(() => this.broadcast());
  }

  add(client: WsClient): void {
    this.clients.add(client);
    this.sendTo(client, this.sessions.list());
  }

  remove(client: WsClient): void {
    this.clients.delete(client);
  }

  private broadcast(): void {
    const snapshot = this.sessions.list();
    for (const client of this.clients) this.sendTo(client, snapshot);
  }

  private sendTo(client: WsClient, sessions: Session[]): void {
    if (client.readyState !== OPEN) return;
    client.send(JSON.stringify({ type: 'sessions', sessions }));
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- ws`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/server/ws.ts src/server/ws.test.ts
git commit -m "feat: WebSocket session broadcaster"
```

---

## Task 7: CLI entry — compose server, ws upgrade, poll loop

**Files:**
- Create: `src/server/index.ts`
- Test: `src/server/index.test.ts`

**Interfaces:**
- Consumes: everything above.
- Produces: `parseArgs(argv: string[]): { port?: number; host?: string; command?: string; open?: boolean }` (exported, unit-tested) and `accessUrl(host: string, port: number, token: string): string` (exported). The default export / `main()` wires `loadConfig` → `SessionManager(createTmux())` → `createApi` → `@hono/node-server` → `ws` upgrade (token validated from cookie) → 2 s `refresh()` poll, then prints the access URL.

- [ ] **Step 1: Write the failing test (pure helpers only)**

`src/server/index.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { parseArgs, accessUrl } from './index.ts';

describe('parseArgs', () => {
  it('parses flags', () => {
    expect(parseArgs(['--port', '5000', '--host', '127.0.0.1', '--open']))
      .toEqual({ port: 5000, host: '127.0.0.1', open: true });
  });
  it('parses --command', () => {
    expect(parseArgs(['--command', 'claude --foo'])).toEqual({ command: 'claude --foo' });
  });
  it('returns empty object for no args', () => {
    expect(parseArgs([])).toEqual({});
  });
});

describe('accessUrl', () => {
  it('uses localhost when host is 0.0.0.0', () => {
    expect(accessUrl('0.0.0.0', 4317, 'tok')).toBe('http://localhost:4317/?token=tok');
  });
  it('uses the given host otherwise', () => {
    expect(accessUrl('192.168.1.5', 4317, 'tok')).toBe('http://192.168.1.5:4317/?token=tok');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- index`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/server/index.ts`**

```ts
import { serve } from '@hono/node-server';
import { WebSocketServer, type WebSocket } from 'ws';
import type { IncomingMessage } from 'node:http';
import { loadConfig, saveConfig } from './config.ts';
import { createTmux } from './tmux.ts';
import { SessionManager } from './sessions.ts';
import { createApi } from './api.ts';
import { SessionBroadcaster } from './ws.ts';

export interface CliArgs {
  port?: number; host?: string; command?: string; open?: boolean;
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

  const server = serve({ fetch: api.fetch, port, hostname: host });

  const wss = new WebSocketServer({ noServer: true });
  // @ts-expect-error node-server exposes the underlying http.Server
  server.on('upgrade', (req: IncomingMessage, socket, head) => {
    if (tokenFromCookie(req) !== config.token) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws: WebSocket) => {
      broadcaster.add(ws);
      ws.on('close', () => broadcaster.remove(ws));
    });
  });

  setInterval(() => { void sessions.refresh(); }, 2000);

  const url = accessUrl(host, port, config.token);
  console.log(`\n  Code Remote Starter is listening on ${host}:${port}`);
  console.log(`  Open from this machine or your phone (same network / Tailscale):\n`);
  console.log(`    ${url}\n`);
  console.log(`  The token in that URL is the only thing protecting a permissionless`);
  console.log(`  Claude. Keep it private; reach the app over a trusted network.\n`);

  if (cli.open) {
    void import('node:child_process').then(({ execFile }) =>
      execFile('open', [accessUrl('localhost', port, config.token)]));
  }
}

const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) main();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- index`
Expected: PASS (5 tests).

- [ ] **Step 5: Manual smoke test (real tmux, real claude)**

Run: `npm start -- --port 4317`
Then from another terminal:
```bash
TOKEN=$(node -e "console.log(require('node:fs').readFileSync(require('node:path').join(require('node:os').homedir(),'.config/code-remote-starter/config.json'),'utf8'))" | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d).token))")
curl -s "http://localhost:4317/api/sessions?token=$TOKEN"            # → {"sessions":[]}
curl -s -X POST "http://localhost:4317/api/sessions" \
  -H "Cookie: crs_token=$TOKEN" -H 'Content-Type: application/json' \
  -d '{"dir":"'"$HOME"'/Developer/code-starter","name":"smoke-test"}'   # → 201
tmux ls                                                              # → crs-... live
```
Expected: the session is created, `tmux ls` shows it, and it appears in the Claude mobile app. Then `curl -X DELETE` with the id ends it. Confirms the full backend works end-to-end.

- [ ] **Step 6: Run the full test suite + typecheck**

Run: `npm test && npm run typecheck`
Expected: all tests PASS; no type errors.

- [ ] **Step 7: Commit**

```bash
git add src/server/index.ts src/server/index.test.ts
git commit -m "feat: CLI entry, ws upgrade, and poll loop"
```

---

## Phase 1 Self-Review

**Spec coverage (Phase 1 scope):**
- Single Node process serving API + WS on one port → Task 7 ✓ (SPA static-serving lands in Phase 3).
- tmux launch with `cym` + remote-control name → Tasks 2, 3, 0 ✓
- Configurable base command (default = cym expansion) → Tasks 1, 7 ✓
- Mandatory token auth on HTTP + WS → Tasks 4, 7 ✓
- CSRF guard → Task 4 ✓
- Session list/create/stop/rename → Tasks 3, 5 ✓
- Live status push + running/ended via tmux poll → Tasks 3, 6, 7 ✓
- Config at `~/.config/code-remote-starter`, 0600 → Task 1 ✓
- Walking-skeleton validation before building → Task 0 ✓
- Deferred to later phases (correctly out of Phase 1): `/api/fs`, bookmarks, recent, SPA, `lastActiveAt` from transcripts.

**Placeholder scan:** No TBD/TODO; every code step has complete code; the only conditional ("if Task 0 finds a flag conflict") names the exact substitution. ✓

**Type consistency:** `Session`, `Tmux`, `SessionManager`, `createApi({ sessions, token })`, `SessionBroadcaster(sessions)`, `WsClient` shape, and `{ type: 'sessions', sessions }` wire format are consistent across Tasks 1, 3, 5, 6, 7. `baseCommand` threaded from config → SessionManager → command builder consistently. ✓

---

## Execution note

After Phase 1 is implemented and the smoke test confirms a session launched via the API shows up on the phone, I'll write the **Phase 2** plan (data APIs) following the same TDD structure, then Phase 3 (frontend), etc.
