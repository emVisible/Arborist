# Arborist

A resident macOS menu-bar control center for my personal apps: one manifest per repo, one status light per app — start, stop, health, logs, in a single place.

> The grove is the ecosystem. The arborist tends it.

I build a lot of small tools. Each one grew its own ad-hoc entry point — `dev.sh`, `start.sh`, `webui.sh`, a Makefile, or plain muscle memory in a shell history. Arborist replaces all of that with one convention: every repo that wants to be managed drops an `app.toml` at its root, and Arborist takes it from there.

Status: **v0.2.0** — control center, local API and the browser portal are shipped; milestones and acceptance criteria in [PLAN.md](PLAN.md).

## Documents

- [PROJECT.md](PROJECT.md) — design decisions, scope, and the decision log
- [PLAN.md](PLAN.md) — the v1 implementation plan: architecture, milestones, acceptance criteria
- [docs/app-toml.md](docs/app-toml.md) — the `app.toml` manifest spec
- [docs/arbor-status.md](docs/arbor-status.md) — the optional `/api/arbor/status` contract for member apps

## Three app kinds, three depths of care

| kind | examples | what Arborist does |
|---|---|---|
| `web` | long-running local services | full lifecycle: start, readiness probe, open browser, stop the process tree, tail logs |
| `app` | desktop apps | unified entry: `open`, running state, icon |
| `menubar` | menu-bar daemons | toggle + login-item management |

Not on purpose: auto-discovery by scanning directories, environment building / dependency management / migrations, remote hosts. The dashboard shipped as the portal in v0.2.0 and consumes the exact same contracts, so nothing built now gets thrown away.

## Install

```sh
pnpm install
pnpm dist        # → release/Arborist-0.2.0-arm64.dmg
```

Or run from source: `pnpm dev`. Tweak the dropdown UI in a plain browser without Electron: `pnpm preview:ui`.

## Quick start

1. First launch creates `~/.arborist/config.toml` — set `roots` to where your repos live (default `["~/Code"]`).
2. Drop an `app.toml` in any repo root under those roots ([spec](docs/app-toml.md)). An app that is installed here but whose repo isn't can live in `~/.arborist/members/<name>/app.toml` instead — add that directory as a root and nothing else changes.
3. Click the tray icon. Left-click a row to start/open; right-click for stop, logs, Finder, login items. When the menu bar is full the icon gets pushed under the notch — `⌥⌘A` (configurable via `hotkey`) always brings the panel up.

Member apps that implement [`/api/arbor/status`](docs/arbor-status.md) get self-reported health and a status line instead of a plain port probe (~30 min to implement).

## Portal

The same state, in your browser: **http://127.0.0.1:8790/** (served by Arborist itself, local-only). App cards with health dots, deep links, a background that follows the time of day, and graceful degradation when the connection drops. Tray right-click → 打开门户. Preview it without Electron: `pnpm preview:portal`.

## License

MIT
