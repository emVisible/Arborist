# Arborist · 实现计划

本文是 v1 的实现路线：技术栈、架构、关键技术决策、里程碑与验收标准。设计立场见 [PROJECT.md](PROJECT.md)，契约见 [docs/app-toml.md](docs/app-toml.md) 与 [docs/arbor-status.md](docs/arbor-status.md)。

技术栈已定：**Electron**（决策记录 8）。

## 1. 技术栈

| 层 | 选择 | 理由 |
|---|---|---|
| 框架 | Electron 最新稳定版 + electron-vite + TypeScript | 复用 ministat 的成熟套路；Tray / BrowserWindow / child_process 都是 Electron 最老牌稳定的 API |
| 渲染层 | React + TS，纯 CSS，不用组件库 | dropdown 面板很小，依赖越少越稳 |
| 配置/清单解析 | smol-toml | **唯一允许的运行时 npm 依赖**，其余全用 Node/Electron 内建 |
| 打包 | electron-builder → dmg（arm64），ad-hoc 签名 | 个人使用，不上商店，不做公证 |
| 自动更新 | 不做 | 个人机手动替换 dmg |

成熟优先的具体含义：零 native 模块、零本地 HTTP 服务（v2 门户才需要）、Electron API 只用稳定十年的那一层（Tray、BrowserWindow、shell、child_process、app.setLoginItemSettings）。

## 2. 架构

```
┌────────────────────────── main process ──────────────────────────┐
│                                                                  │
│  Registry ──► Supervisor ──► Prober ──► TrayController           │
│  (配置 roots,   (spawn/组杀,    (轮询就绪与          (Tray 图标,        │
│   扫描并解析     pid/日志,      /api/arbor/          dropdown 定位,    │
│   app.toml)     分支检查)      status 契约)          失焦隐藏)         │
│                                                                  │
│  IPC (contextBridge) ◄── renderer: React dropdown + 日志窗口        │
└──────────────────────────────────────────────────────────────────┘
```

- **Registry**：读 `~/.arborist/config.toml` 的 roots，在 roots 第一层子目录里寻找 `app.toml`（确定性查找，非推断），解析校验，坏文件在 UI 上给出带文件名的错误。
- **Supervisor**：web 类的 spawn（独立进程组）、pidfile、日志落盘、TERM→KILL 停止、启动前分支检查。
- **Prober**：每个 web 类 app 一条轮询循环（默认 10s）：先试 `/api/arbor/status`（1.5s 超时）→ 降级 manifest `ready` 探测 → 再降级 `tcp`。启动后前几次探测做 500ms→1s→2s 退避，尽快触发"开浏览器"。
- **TrayController**：Tray + 无边框 dropdown 窗口，点击托盘图标在图标正下方弹出，失焦即隐藏。
- **状态不持久化**：灯只反映轮询结果（决策 5），Arborist 重启后重新轮询即完成认领，磁盘上只有 config / pids / logs。

### 状态机（web 类）

```
stopped → start() → starting ─probe ok─► running
                        │                   │
                        │ 超时 60s           │ stop()
                        ▼                   ▼
                      error              stopping ─► stopped
running ─probe 连续失败─► error（进程若还在则灯红，日志可见）
启动前分支检查不过 ─► blocked（黄灯，拒绝 start）
```

灯色：灰=stopped / 黄=starting·blocked / 绿=ok / 橙=degraded / 红=error。`app` / `menubar` 类不探测，注册即显示，本次会话内由 Arborist 启动过则亮绿。

## 3. 关键技术决策（实现层）

1. **进程组**：`spawn(start, { detached: true, shell: true, stdio: ['ignore', logFd, logFd] })`。POSIX 上 detached 即新进程组，pid 即 pgid；停止时 `process.kill(-pid, 'SIGTERM')`，5s 后仍在则 `SIGKILL`——`npm run dev → vite → node` 的整棵子树一并收掉。pidfile 落在 `~/.arborist/pids/<name>.pid`。
2. **日志**：spawn 时以 append 模式接 `~/.arborist/logs/<name>.log`；每次启动前若超过 5MB 先截断（v1 够用的最简轮转）。UI 从文件 tail。
3. **开浏览器只在"由 Arborist 启动"时**：starting→ok 的那次转移触发 `shell.openExternal(url)`。服务是被外部脚本拉起的（轮询变绿）不弹浏览器，避免骚扰。
4. **分支检查**：`git -C <repo> rev-parse --abbrev-ref HEAD`，与 `branch` 不符 → blocked 黄灯。repo 无 git 时警告但放行。
5. **app / menubar 类**：启动 `open -a`。运行态检测**不做**（需要 osascript + Automation 权限，收益低）；`login = true` 的 login item 管理用 System Events osascript 读写，需要一次性 Automation 授权，拒绝则降级为"打开系统设置的登录项面板"。Arborist 自身的自启用 `app.setLoginItemSettings`，无需权限。
6. **IPC 安全**：`nodeIntegration: false`、`sandbox: true`、仅 contextBridge 暴露白名单方法。
7. **不做本地 HTTP server**：v2 门户立项时再加，v1 的攻击面只有本机 IPC。

## 4. 数据与文件布局

```toml
# ~/.arborist/config.toml —— 全部配置就这些
roots            = ["~/Code", "~/Game"]   # 在这些目录的第一层子目录里找 app.toml
poll_interval_ms = 10000
```

```
~/.arborist/
  config.toml
  pids/<name>.pid      # web 类，内容 = pgid
  logs/<name>.log      # web 类 stdout+stderr
```

不存状态、不存布局偏好（v1 面板没有可布局的东西）。

## 5. IPC 面（main ↔ renderer）

| channel | 方向 | 载荷 |
|---|---|---|
| `arbor:list` | req | `App[]`（name/title/type/state/line/icon） |
| `arbor:start` / `arbor:stop` | req | `{name}` |
| `arbor:open` | req | `{name}`（web 开 url，app/menubar 走 `open -a`） |
| `arbor:logs:tail` | req | `{name, lines}` → 文本 |
| `arbor:reveal` | req | `{name}`（Finder 里显示 repo） |
| `arbor:rescan` | req | 重新扫描 roots |
| `arbor:event` | push | `{name, state, line}` 状态变化 |

## 6. 里程碑

每个里程碑独立可验收、独立成 commit 系列。估时按"自己 + agent 结对"计。

**M0 · 骨架（0.5d）**
electron-vite + TS + React 跑通；Tray 图标 + 空 dropdown（失焦隐藏）；`dev / build / dist` 三命令可用，出 dmg。
验收：菜单栏出现图标，点开空面板；`npm run dist` 产出可打开的 dmg。

**M1 · 注册表（0.5d）**
config.toml 读取；roots 扫描 + app.toml 解析校验；列表静态展示（含解析错误的友好显示）。
验收：`~/Code` 下放两个真实 app.toml（如 Ametrine、Hertz）能正确列出；写一个缺 `type` 的坏 toml，UI 显示文件名 + 缺字段而非崩溃。

**M2 · web 生命周期（1.5d）**
spawn（进程组）/ 日志落盘 / 就绪探测三级降级 / 就绪开浏览器 / TERM→KILL 停止 / 分支黄灯 / 状态机 / 轮询与认领。
验收：对 Ametrine 走完 start→绿灯→自动开浏览器→stop；`ps` 确认无残留进程；Arborist `kill -9` 后重启，未停的 Ametrine 灯仍为绿（认领）；checkout 切到非 main 分支后 start 被黄灯拒绝；端口被占时进入 error 且日志窗口能看到 EADDRINUSE。

**M3 · UI 完整（1d）**
灯色、左键点击（启动/打开）、右键菜单（启动、停止、打开、日志、reveal、重扫）、独立日志窗口实时 tail、status 契约的 `line` 文案展示。
验收：上述全部操作零终端；日志窗口随输出滚动。

**M4 · app / menubar 类（1d）**
`open -a` 启动；login item 读写（osascript + 权限降级路径）；Arborist 自身自启设置。
验收：Hertz / Axiforge 一键打开；Thistelles 的自启开关真实生效（注销重登验证一次）。

**M5 · 收尾与狗粮（1d）**
Arborist 自己的 app.toml（`type = "menubar"`，自注册）；Ametrine 实现 `/api/arbor/status` 并点亮"自报健康"；README 更新（安装、配置、成员接入指南）；dmg 装机自用。
验收：连续一周日常使用不回归终端启动方式；三类 app 各至少一个真实成员。

**v1 完成定义**：M0–M5 全过 + 最后一项日常使用验收。

## 7. 测试策略

- **单测（vitest）**：app.toml 解析与校验的边界（缺字段、错类型、未知 type、中文值）、状态机转移合法性、probe 结果解析。
- **Supervisor 集成测试**：`fixtures/spawn-tree.sh`（父→子→孙三层 sleep 进程树），验证组杀后 `pgrep` 无残留。
- **手工清单**：每里程碑验收项即清单；外加"端口占用→红灯且日志可解释""kill -9 Arborist→重启认领"两条回归项。
- 不做 E2E 自动化，Playwright 进 backlog。

## 8. 风险与对策

| 风险 | 对策 |
|---|---|
| Electron 常驻内存 ~200MB | 已在决策 8 接受；上线后用 ministat 对比观察，超标再议 |
| System Events Automation 权限被拒 | login 管理降级为打开系统设置面板，UI 明示原因 |
| `shell: true` 的引号/注入 | start 命令来自本人 manifest，非外部输入，风险接受 |
| 端口冲突 | 不做仲裁（backlog）：探测超时→红灯，日志解释 |
| Electron 大版本升级破坏 API | 锁 minor；升级是显式决定，不随 `npm up` 漂移 |

## 9. Backlog（编号防漂移，v1 一律不做）

1. 端口冲突仲裁与分配
2. `app` / `menubar` 运行态检测（osascript）
3. 自动更新
4. v2 门户（消费 status 契约的浏览器首页）
5. `/api/arbor/search`、`/api/arbor/actions`
6. roots 下"疑似可注册 repo"的提示（只提示，不推断启动方式）
7. Playwright E2E
