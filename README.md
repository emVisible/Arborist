# Arborist

A resident macOS menu-bar control center for my personal apps: one manifest per repo, one status light per app — start, stop, health, logs, in a single place.

> The grove is the ecosystem. The arborist tends it.

I build a lot of small tools. Each one grew its own ad-hoc entry point — `dev.sh`, `start.sh`, `webui.sh`, a Makefile, or plain muscle memory in a shell history. Arborist replaces all of that with one convention: every repo that wants to be managed drops an `app.toml` at its root, and Arborist takes it from there.

Status: **spec phase** — the contracts are the first deliverable, so member apps (Ametrine, Axiforge, …) can implement them while the UI is being built.

## Documents

- [PROJECT.md](PROJECT.md) — design decisions, scope, and the decision log
- [docs/app-toml.md](docs/app-toml.md) — the `app.toml` manifest spec
- [docs/arbor-status.md](docs/arbor-status.md) — the optional `/api/arbor/status` contract for member apps

## Three app kinds, three depths of care

| kind | examples | what Arborist does |
|---|---|---|
| `web` | long-running local services | full lifecycle: start, readiness probe, open browser, stop the process tree, tail logs |
| `app` | desktop apps | unified entry: `open`, running state, icon |
| `menubar` | menu-bar daemons | toggle + login-item management |

Explicitly not in v1: auto-discovery by scanning directories, environment building / dependency management / migrations, remote hosts, and a web dashboard — the v2 portal will consume the exact same contracts, so nothing built now gets thrown away.

## License

MIT
