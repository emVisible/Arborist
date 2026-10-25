# Arborist · 树艺师

常驻 macOS menu bar 的个人 app 中控台：每个 repo 一份清单、每个 app 一盏状态灯——启动、停止、健康、日志，都在一个地方。

> 树林（Grove）是生态，树艺师（Arborist）照看它。

我做了很多小工具，每个都长出了自己的启动入口——`dev.sh`、`start.sh`、`webui.sh`、Makefile，或者只是肌肉记忆里的 shell 历史。Arborist 用一个约定替代这一切：想被管理的 repo 在根目录放一个 `app.toml`，剩下的交给 Arborist。

当前状态：**规划完成**——技术栈已定（Electron），实现路线见 [PLAN.md](PLAN.md)；成员 app 可并行实现状态契约。

## 文档

- [PROJECT.md](PROJECT.md) — 设计决策、范围与决策记录
- [PLAN.md](PLAN.md) — v1 实现计划：架构、里程碑与验收标准
- [docs/app-toml.md](docs/app-toml.md) — `app.toml` 清单规范
- [docs/arbor-status.md](docs/arbor-status.md) — 成员 app 可选实现的 `/api/arbor/status` 契约

## 三类 app，三种照看深度

| 类型 | 例子 | Arborist 做什么 |
|---|---|---|
| `web` | 长驻本地服务 | 全生命周期：启动、就绪探测、开浏览器、停掉进程树、看日志 |
| `app` | 桌面应用 | 统一入口：`open`、运行状态、图标 |
| `menubar` | menu bar 守护 | 开关 + login item 管理 |

v1 明确不做：目录扫描自动发现、环境构建 / 依赖管理 / 数据库迁移、远程主机、web 仪表盘——v2 门户会消费同一套契约，现在做的任何东西都不会被扔掉。

## 安装

```sh
pnpm install
pnpm dist        # → release/Arborist-0.1.0-arm64.dmg
```

源码运行：`pnpm dev`。不启动 Electron、在浏览器里直接调 dropdown UI：`pnpm preview:ui`。

## 快速上手

1. 首次启动会生成 `~/.arborist/config.toml`——把 `roots` 配成你的 repo 所在目录（默认 `["~/Code"]`）。
2. 在这些目录下的任意 repo 根目录放一个 `app.toml`（[规范](docs/app-toml.md)）。
3. 点击托盘图标：左键一行启动/打开；右键有停止、日志、Finder、登录项。

实现了 [`/api/arbor/status`](docs/arbor-status.md) 的成员 app 状态灯显示"自报健康 + 一行状态"，否则降级为端口探测（实现约 30 分钟）。

## 许可

MIT
