# app.toml — 清单规范

每个想被 Arborist 管理的 app，在自己 repo 的根目录放一个 `app.toml`。这是**唯一的注册方式**——Arborist 不做目录扫描推断。注册成本 30 秒，零误判。

## 字段

| 字段 | 类型 | 适用 | 必填 | 含义 |
|---|---|---|---|---|
| `name` | string | 全部 | ✅ | 唯一 id，小写。用于 pid 文件、日志、状态目录命名 |
| `title` | string | 全部 | — | 显示名，缺省用 `name` |
| `type` | enum | 全部 | ✅ | `web` / `app` / `menubar` |
| `start` | string | web | ✅ | 启动命令，工作目录为 repo 根 |
| `url` | string | web | ✅ | 服务地址，就绪后在默认浏览器打开 |
| `ready` | string | web | — | 就绪探测，缺省 `http:/` |
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

**web — Ametrine**

```toml
name  = "ametrine"
title = "Ametrine"
type  = "web"
start = "./dev.sh"
url   = "http://127.0.0.1:8710"
ready = "http:/healthz"
branch = "main"
icon  = "docs/icon.png"
notes = "自托管 RAG 工作台"
```

**app — Hertz**

```toml
name  = "hertz"
title = "Hertz"
type  = "app"
open  = "Hertz"
icon  = "docs/icon.png"
```

**menubar — Thistelles**

```toml
name  = "thistelles"
title = "Thistelles"
type  = "menubar"
open  = "Thistelles"
login = true
```
