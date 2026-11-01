# app.toml — 清单规范

每个想被 Arborist 管理的 app，放一份 `app.toml` 作为**显式清单**——Arborist 不做目录扫描推断。注册成本 30 秒，零误判。

两个住处，按 app 的形态选：

| 住处 | 用于 |
|---|---|
| `<repo>/app.toml` | 有源码仓的成员（三类都行） |
| `~/.arborist/members/<name>/app.toml` | 本机 `/Applications` 里装着、但源码仓不在这台机器的 app（只适合 `app` / `menubar`，见文末「清单目录」） |

清单目录也要先被登记成一个 root（`config.toml` 的 `roots` 里加 `"~/.arborist/members"`）——发现机制本来就只认「root 的第一层子目录里有 `app.toml`」，多一个住处不需要任何特殊代码路径。

## 字段

| 字段 | 类型 | 适用 | 必填 | 含义 |
|---|---|---|---|---|
| `name` | string | 全部 | ✅ | 唯一 id，小写。用于 pid 文件、日志、状态目录命名 |
| `title` | string | 全部 | — | 显示名，缺省用 `name` |
| `type` | enum | 全部 | ✅ | `web` / `app` / `menubar` |
| `start` | string | web | ✅ | 启动命令，工作目录为 repo 根 |
| `url` | string | web | ✅ | 服务地址，就绪后在默认浏览器打开 |
| `ready` | string | web | — | 就绪探测，缺省 `http:/` |
| `start_timeout_ms` | number | web | — | 启动就绪预算（毫秒，≥1000），缺省 60000。冷启动慢的成员按实测调大 |
| `branch` | string | web | — | 限定启动分支（产品模式纪律），缺省不检查 |
| `open` | string | app / menubar | ✅ | 传给 `open -a` 的应用名或 bundle id |
| `login` | bool | menubar | — | 由 Arborist 统一管理 login item |
| `icon` | string | 全部 | — | 相对 repo 根的路径，建议 128px PNG |
| `notes` | string | 全部 | — | 自由文本备注 |

## 就绪探测 `ready`

就绪 ≠ 端口通。服务可能端口已 bind 但还在加载模型或建索引，必须等探测通过才开浏览器。

| 写法 | 语义 |
|---|---|
| `http:/healthz` | GET `url + /healthz`，2xx 即就绪（相对路径以 `url` 为基） |
| `http://127.0.0.1:9999/ready` | 绝对 URL，独立于 `url` |
| `tcp` | `url` 的端口可连接即就绪（最后手段） |

若 app 实现了 [`/api/arbor/status`](arbor-status.md)，优先采用其 `state`。

## 进程与停止

- `web` 启动时以**独立进程组**（pgid）detach 运行，Arborist 自身退出不影响服务。
- pgid 记录在 `~/.arborist/pids/<name>.pid`。
- 停止顺序：向整个进程组发 TERM（`npm run dev` → vite → node 的子树一并收掉），5 秒仍存活则 KILL。
- 状态灯只反映探测结果，不记录"是不是 Arborist 启动的"——因此 Arborist 重启后重新轮询即完成认领，无状态需迁移。

## 分支纪律（产品模式）

manifest 声明 `branch = "main"` 时，启动前检查 repo 当前 checkout：不在 main → 黄灯，拒绝启动，提示切回。开发在分支上进行，合并即发布。`app` / `menubar` 类通常指向已安装的 .app，不受此约束。

## 示例

**web — Ametrine**（本机实际在跑的一份，2026-10-26 实测）

```toml
name   = "ametrine"
title  = "Ametrine"
type   = "web"
start  = "./arborist-start.sh"
url    = "http://127.0.0.1:8000"
ready  = "http:/api/arbor/status"
start_timeout_ms = 180000
branch = "main"
icon   = "apps/frontend/public/favicon.png"
notes  = "本地优先 RAG 知识库。数据层缺席时契约回 degraded 并点名是谁"
```

`start_timeout_ms` 是实测出来的：Ametrine 冷启动要 75–120s（torch 导入），而缺省预算 60s ——
不声明的话每次启动都会先闪一条「启动超时」，再靠轮询自愈。慢成员按自己的实测值声明，别抬全局缺省。

`ready` 指到契约路径而不是首页，是为了堵掉降级链的一条假绿：前端 HTML 一直会回 200，
后端死了它照样回 200 —— 于是「端口通了」被当成「应用活着」。实现了契约的成员都该这么写。

**app — Hertz**（本机实际在用的一份，2026-11-01 实测）

```toml
name  = "hertz"
title = "Hertz"
type  = "app"
open  = "ai.hertz.app"
icon  = "electron/build/icon.png"
```

`app` 类不由 Arborist 构建：成品得 repo 自己产出并装/注册好（这里是 `pnpm --filter hertz-electron build:dir` 到 repo 内，再 `lsregister -f` 注册）。`open` 写 bundle id，运行态走 `lsappinfo`；写应用名则走 `pgrep -x`，打包后的进程名未必等于应用名。

**menubar — Thistelles**（住在清单目录，本机实际在用的一份）

```toml
name  = "thistelles"
title = "Thistelles"
type  = "menubar"
open  = "com.thistelles.app"
icon  = "icon.png"
```

`open` 写 bundle id 而不是应用名，是因为运行态检测分两条路：应用名走 `pgrep -x`（只认进程名），bundle id 走 `lsappinfo`。Thistelles 打包后的进程名是 `PythonRuntime`，写 `"Thistelles"` 的话灯会永远灰着——而“永远灰”看起来像“没在跑”，不像“检测失灵”。不写 `login` 就不碰登录项：登录项管理要一次性 Automation 授权，不该在登记成员那一刻被顺手触发。

## 清单目录

`~/.arborist/members/<name>/app.toml` 是给「成品装在 `/Applications`、源码仓不在这台机器」的 app 用的。几条边界，都是它的形状决定的：

- 只对 `app` / `menubar` 成立。`web` 类的 `start` 以 repo 根为工作目录，清单目录里没有代码可跑。
- 它是清单，不是仓库的替身：右键“在 Finder 里显示”指向 `app.toml` 本身，`icon` 也相对这个目录。
- 图标不必手工做：`sips -s format png --resampleWidth 128 /Applications/Xxx.app/Contents/Resources/*.icns --out icon.png`。
- 未注册计数只数 roots 里的第一层子目录，所以这个目录里只放「每个都登记好了」的子目录，别往里堆临时东西。
