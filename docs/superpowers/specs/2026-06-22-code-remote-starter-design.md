# Code Remote Starter — Design

**Date:** 2026-06-22
**Status:** Approved (pending spec review)
**Working name:** Code Remote Starter · package/repo `code-remote-starter` · CLI `code-remote-starter` (short alias `crs`)
*(npm + GitHub name availability to be confirmed before first publish.)*

---

## 1. Problem

The Claude mobile app's Remote Control can drive **sessions that already exist**, but there is no way to **start a new Claude Code session in an arbitrary directory** from your phone. You still have to walk to the Mac, open a terminal, `cd`, and run `cym`.

`cym` is the user's alias:

```
cym = claude --dangerously-skip-permissions --effort max
```

The user's `~/.claude/settings.json` already has `remoteControlAtStartup: true`, so **any** session that starts on the Mac automatically registers for Remote Control and appears in the mobile app.

**The gap is purely the launch step.** Code Remote Starter is a small web app that runs on the Mac and is reachable from the phone. You pick (or bookmark) a directory, confirm, and it spawns `cym` there. Remote Control auto-enables, the session shows up in the Claude app, and you drive it from your phone as usual.

## 2. Goals & non-goals

**Goals**
- Start a Claude Code session in any directory on the Mac, from a phone browser.
- A genuinely good, touch-first **directory picker**: browse, paste a path, bookmark, and see recently-used directories.
- See and manage sessions this tool launched (running/ended, stop, rename).
- A distinctive, fast, accessible UI that is excellent on phone, foldable, and desktop. Dark, refined, no emoji, no "AI slop."
- Ship as a high-quality open-source project (MIT, README, tests, CI).

**Non-goals (for MVP)**
- No embedded terminal / no in-browser chat. Interaction happens in the Claude mobile app via Remote Control. (Launcher + session manager only.)
- No built-in tunnel. The app binds to a port; the user reaches it over LAN/Tailscale/their own tunnel. (Revisited later.)
- No multi-user, no auth provider integration beyond a single shared token.
- No Windows support (macOS-first; Linux likely works incidentally but is untested).
- Rich "working vs needs-input" session status is a **Phase 2** enhancement, not MVP.

## 3. Primary flow

1. **Home** shows running sessions and a prominent **`+ New session`** action.
2. Tapping **`+`** opens the **directory picker** (full-screen on phone, two-pane on wide screens).
3. **Browse** the filesystem (breadcrumb + folder list), or switch to **Bookmarks** / **Recent** tabs, or paste an absolute path. Tapping a folder **selects** it; the `›` chevron **descends** into it. A bottom bar shows the chosen path + **`Use ›`**.
4. **Confirm** sheet shows the chosen path, an editable **session name** (default = folder basename), and the exact **command** that will run. Tap **`Start session`**.
5. The session spawns in that directory with Remote Control on. A toast confirms; it appears in **Running**. Switch to the Claude app to drive it.

## 4. Architecture

A single Node + TypeScript process serves everything on one port (one URL for the phone): the built React SPA, a small HTTP API, and a WebSocket for live status.

```
                 Phone / Desktop browser
                          │  (HTTP + WebSocket, token-gated)
                          ▼
┌─────────────────────────────────────────────────────────┐
│  code-remote-starter  (Node + TypeScript, one port)      │
│                                                          │
│  HTTP API (Hono)        WebSocket (ws)                   │
│   ├─ /api/fs            └─ session status push           │
│   ├─ /api/bookmarks                                      │
│   ├─ /api/recent        Session Manager ─── tmux ──┐     │
│   ├─ /api/sessions          (spawn/list/kill/poll) │     │
│   └─ static SPA                                    │     │
│                                                    ▼     │
│  Stores: config.json (token, prefs),         tmux server │
│          bookmarks.json                       (detached  │
│  Services: FS, Recent (reads ~/.claude),       sessions) │
│            Auth, Config                            │     │
└────────────────────────────────────────────────────┼────┘
                                                     ▼
                       claude --dangerously-skip-permissions
                       --effort max  (Remote Control on)
                                                     │
                                                     ▼
                                   Anthropic Remote Control  →  Claude mobile app
```

### 4.1 Backend components

- **HTTP API (Hono).** Runtime-agnostic, tiny. Validates input with `zod`.
- **WebSocket (`ws`).** Pushes session lifecycle/status changes to connected clients. Token-gated on upgrade.
- **Session Manager.** Owns the lifecycle of launched sessions via tmux (§5). Polls tmux (~2 s) to detect ended sessions and pushes diffs over WS.
- **FS service.** Lists directories for the picker; annotates each entry with `isGitRepo` and `usedWithClaude` (§6).
- **Recent service.** Surfaces recently-used directories (§6).
- **Bookmarks store.** CRUD over a JSON file (§7).
- **Auth + Config.** Token generation/validation, config persistence (§7, §8).

### 4.2 Frontend components

- **Screens:** Home (running list + `+`), Directory Picker (tabs: Browse / Bookmarks / Recent), Confirm sheet, Token-entry fallback.
- **Building blocks:** SessionRow, FolderRow, Breadcrumb, FilterInput (filter or paste path), Tabs, BottomBar, Sheet, Toast, EmptyState.
- **State:** TanStack Query for server state; WebSocket subscription updates the session cache live. Lightweight client routing (`wouter`) or a small screen state machine.
- **Design system:** §9.

## 5. Session lifecycle (tmux)

Each session runs in its own **detached tmux session**, which provides the pseudo-terminal Claude Code needs while keeping the process alive independently of the browser and even of the Code Remote Starter server.

**Spawn**
```
tmux new-session -d -s "crs-<shortid>" -c "<dir>" \
  "<baseCommand> --remote-control '<name>'"
```
- `baseCommand` is configurable; **default = the `cym` expansion** `claude --dangerously-skip-permissions --effort max`.
- `<name>` is the user-supplied session name (default = folder basename).
- The server must run in the user's normal shell environment so `claude`'s auth (keychain/OAuth, PATH) is inherited by the tmux session.

**Why tmux:** the process survives a server restart; the user can `tmux attach -t crs-<id>` from the Mac to inspect; listing and killing are trivial; tmux 3.6b is already installed.

**List / detect alive:** `tmux list-sessions -F '#{session_name}'`, filtered to the `crs-` prefix and cross-referenced with our store.

**Stop:** `tmux kill-session -t "crs-<shortid>"`.

**Rename:** updates the local display label only. (The Remote-Control name registered with Anthropic at launch does not change; documented as a known limitation.)

> **Milestone 0 validates the exact flags.** Whether we pass `--remote-control "<name>"` explicitly or rely on `remoteControlAtStartup` + `-n "<name>"` is finalized once we confirm a detached-tmux session registers and is drivable from the phone (§11).

### 5.1 Status

- **MVP:** `running` (with "active <relative-time> ago") and `ended`. "Active" is derived from the mtime of the session's Claude transcript file under `~/.claude/projects/…`. Liveness is authoritative from tmux.
- **Phase 2:** a finer `working` vs `needs-input` distinction via an optional Claude Code hook that the app installs **with the user's consent** (writes per-session state the app reads). Not in MVP to avoid over-promising and avoid silently editing the user's settings.

## 6. Directory data

- **Browse** — `GET /api/fs?path=<abs>` returns the directory's child **directories**, each annotated:
  - `isGitRepo`: `<path>/.git` exists.
  - `usedWithClaude`: the Claude project dir for this path exists. Computed in the **reliable direction** by encoding the absolute path the way Claude does (`/` → `-`, e.g. `/Users/burakgon/Developer/code-starter` → `-Users-burakgon-Developer-code-starter`) and checking `~/.claude/projects/<encoded>`.
  - `childDirCount`, `hidden` (dotfiles hidden by default, toggleable).
  - Response also includes `parent` and a `readable` flag; permission/IO errors are reported per-entry, never crash the listing.
- **Paste a path** — the filter input accepts an absolute path or `~`; on Enter it validates (exists, is a directory) and navigates there.
- **Recent** — union of:
  1. **App launch history** (reliable): directories this tool has launched, most-recent first.
  2. **Claude history** (best-effort): real `cwd` values extracted from Claude transcript files under `~/.claude/projects/*/*.jsonl`, deduped, sorted by recency. We read the `cwd` recorded **inside** the transcripts rather than decoding folder names (the `/`→`-` encoding is lossy and not safely reversible). Marked best-effort because Claude's on-disk format may change.

## 7. Storage & data model

Config lives under an XDG-style dir: `~/.config/code-remote-starter/` (override via `CRS_CONFIG_DIR`). Files are created with `0600` permissions.

**`config.json`**
```jsonc
{
  "token": "<64-hex>",            // generated on first run
  "port": 4317,
  "host": "0.0.0.0",
  "baseCommand": "claude --dangerously-skip-permissions --effort max",
  "launchHistory": [               // feeds Recent (capped, e.g. 50)
    { "path": "/Users/.../code-starter", "lastLaunchedAt": 1718995200000, "count": 3 }
  ]
}
```

**`bookmarks.json`**
```jsonc
[
  { "id": "bk_…", "path": "/Users/.../code-starter", "label": "code-starter",
    "order": 0, "addedAt": 1718995200000 }
]
```

**Session (in-memory, mirrored to disk for restart recovery)**
```ts
type Session = {
  id: string;            // shortid; tmux name = `crs-${id}`
  name: string;          // display + remote-control name
  dir: string;
  startedAt: number;
  status: 'running' | 'ended';
  lastActiveAt?: number; // from transcript mtime
};
```

## 8. Security

The app launches `claude --dangerously-skip-permissions`, so access control is mandatory.

- **Token** — 32 random bytes (hex), generated on first run, stored in `config.json`. Printed as part of the startup URL: `http://<host>:<port>/?token=…`.
- **Gate** — every HTTP request and the WebSocket upgrade require a valid token (from the `?token=` query or the cookie). The first request with a valid `?token=` sets an `httpOnly`, `SameSite=Strict` cookie and redirects to a clean URL. Missing/invalid token → 401 (API) or a minimal "paste your token" page (navigations).
- **CSRF** — state-changing requests (POST/DELETE) require the cookie **and** pass an `Origin`/`Host` allowlist check (same-origin by default; extra origins configurable). `SameSite=Strict` is the primary defense.
- **Binding** — default `host` is `0.0.0.0` so the phone can reach it over LAN/Tailscale (the explicit near-term need); the token is the protection. Configurable via `--host`. Startup prints a clear notice of where it is listening and that the token is the only thing standing between the network and a permissionless Claude. A future hardening pass (loopback default + first-class tunnel) is tracked as out-of-scope follow-up.
- **No telemetry.** Nothing leaves the machine except Claude's own traffic.

## 9. Design system

Direction **A**, locked during visual brainstorming:

- **Mood:** dark, dense, refined — Raycast/Linear energy, "serious developer tool."
- **Palette:** background `#0b0c0e`; surface `#141518`; borders `#1d1e22`/`#26272b`; text `#e6e7e9`, dim `#7b7d82`/`#62646a`. Single accent: **Claude coral** gradient `#e08a6b → #c2543a`. Status: green `#5fb87a` (running/active), amber `#e0a85f` (needs input).
- **Type:** system UI stack for chrome; `ui-monospace` for paths and the command preview. No web font download (fast first paint).
- **Icons:** `lucide-react` line icons (folder, search, plus, chevron, etc.). **No emoji anywhere.**
- **Indicators:** git = small green dot; previously-used-with-Claude = small coral `claude` tag.
- **Motion:** subtle, fast (sheet slide-up, toast, selection highlight). Respects `prefers-reduced-motion`.
- **Responsive:**
  - **Phone (narrow):** single column; picker is full-screen; sticky bottom bar; large tap targets.
  - **Foldable / desktop (wide):** two-pane picker — left rail (Bookmarks + Recent), right pane (Browse + launch). Validated at folded (~280–400px) and unfolded (~768px+) widths.
- **Accessibility:** semantic HTML, labelled controls, visible focus rings, full keyboard path (arrow keys to move, Enter to select/launch, Esc to close), AA contrast, screen-reader friendly.

## 10. Error handling

- **tmux missing** → clear message + `brew install tmux`.
- **`claude` not on PATH / not authed** → surface the spawn failure with the underlying stderr; hint to run the server from the same shell where `cym` works.
- **Directory not readable / gone** → inline, non-fatal notice in the picker; the rest of the listing still renders.
- **Spawn failure** → toast with the error; nothing added to Running.
- **401 / bad token** → token-entry page.
- **WebSocket drop** → automatic reconnect with backoff; UI shows a subtle "reconnecting" state and refetches on resume.

## 11. Testing & validation

- **Milestone 0 — walking skeleton (manual, with the user).** The riskiest assumption: a `claude --dangerously-skip-permissions --effort max --remote-control "<name>"` launched inside a **detached** tmux session (a) registers for Remote Control, (b) appears in the mobile app, and (c) is drivable from the phone — with auth inherited from the user's environment. Prove this with a single command before building UI. The exact flag set is finalized here.
- **Unit (Vitest):** path encoding + `usedWithClaude` check; transcript `cwd` extraction (with fixtures); bookmarks store; session manager against a **mocked tmux** (spawn/list/kill, status diffing); command builder.
- **Integration:** API endpoints with auth (happy path + 401 + CSRF rejection); session create against a harmless fake command instead of real `claude`.
- **E2E (Playwright, optional for MVP):** the `+` → pick → confirm → running flow, at phone and desktop viewports.
- **CI (GitHub Actions):** lint, typecheck, test, build on push/PR.

## 12. Tech stack

- **Backend:** Node + TypeScript · Hono (HTTP) · `ws` (WebSocket) · `zod` · `node:child_process` (tmux).
- **Frontend:** React 19 · Vite · TypeScript · Tailwind CSS v4 · TanStack Query · `wouter` · `lucide-react`.
- **Tooling:** npm · ESLint + Prettier · Vitest · Playwright · GitHub Actions · MIT license.
- **Run:** dev = `npm run dev` (Vite + server with proxy). Prod = `npm start` / `npx code-remote-starter` (server serves built assets + API + WS on one port).

## 13. Build sequence

0. **Walking skeleton** — validate detached-tmux Remote Control end-to-end (§11).
1. **Backend core** — config + token, Session Manager (tmux spawn/list/kill + poll), launch API, WS status. Smoke-test with curl.
2. **Data APIs** — FS browse (+ indicators), bookmarks CRUD, recent.
3. **Frontend shell** — auth/token, Home + running list, live WS updates, design tokens.
4. **Picker** — Browse / Bookmarks / Recent, breadcrumb, filter/paste, indicators → Confirm sheet → launch.
5. **Manage** — stop, rename, toasts, errors, empty states.
6. **Responsive & a11y polish** — phone / foldable / desktop, keyboard.
7. **Release** — README (with screenshots/GIF), tests, CI, MIT.

## 14. Future (out of scope now)

- Optional hook-based `working`/`needs-input` status.
- First-class remote access: loopback-by-default + built-in tunnel (Cloudflare/Tailscale helper).
- Light theme (Direction B exists as a reference).
- Per-launch overrides in the confirm sheet (model/effort), session templates.
- Linux/Windows support.

## 15. Open questions (resolve in Milestone 0 / planning)

1. Exact Remote Control flag combination for detached tmux (`--remote-control "<name>"` vs `-n` + startup setting).
2. Confirm the transcript `cwd` field name/shape for the Recent service.
3. Default port choice (proposed `4317`) and whether to auto-pick on conflict.
