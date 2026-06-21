# Contributing

Thanks for your interest in Code Remote Starter.

## Development

Requires Node 20+, `tmux`, and Claude Code on your `PATH`.

```bash
npm install
npm run dev        # server (:4317) + web (:5173) with hot reload
```

Before opening a pull request, make sure these all pass — CI runs the same four:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Guidelines

- Keep the dark "Direction A" aesthetic; no emoji in the UI.
- Add tests for new behavior (Vitest, co-located `*.test.ts`).
- Keep files small and focused — one clear responsibility each.

## Layout

- `src/server` — Hono API + WebSocket; sessions run in detached `tmux`.
- `src/web` — React + Vite + Tailwind SPA.
- `docs/superpowers` — design spec and implementation plan.
