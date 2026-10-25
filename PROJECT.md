# Arborist · 设计记录

一句话定位：**menu bar 常驻的个人 app 中控台——进程总管 + 状态面板。管点火，不管聚合。**

本文记录 Arborist 是什么、不是什么，以及每一个关键决策的理由。规范细节见 [docs/app-toml.md](docs/app-toml.md) 和 [docs/arbor-status.md](docs/arbor-status.md)。

## 背景

这份设计脱胎于《The Grove · 个人数字生态蓝图》的第二节。蓝图里的 Grove 是一个浏览器仪表盘：假设六大 app 全部在跑，它只负责聚合状态、统一导航、全局搜索。经过一轮审视，结论是：

- 仪表盘的价值 = 活着的、可聚合的 app 数量，而当前生态只有两三个活着的成员——**给半死生态做首页，是给不存在的城市画地图**。
- 中控台的价值 = 把 app 跑起来的能力，从第一天就成立，不依赖生态存活率。

于是 Grove 拆成两个产品：**中控台（本项目，先行）**和**门户（v2，消费同一契约）**。蓝图的技术原则全部继承：壳核分离、优雅降级、中控台不存业务数据、URL scheme 深链。

它替代的现状：每个 repo 自发长出的启动入口（Ametrine 的 `dev.sh`、monoline 和 Clearance 的 `start.sh`、rewind 的 `webui.sh`、Thistelles 的 `guide.sh`），以及"打开终端 → cd → 想半天怎么起"的日常。

## 四个组成部分

1. **`app.toml` manifest 约定** — 每个 repo 一个文件，注册成本 30 秒，声明怎么跑、在哪、怎么算就绪。
2. **可选状态契约 `/api/arbor/status`** — 成员 app 半小时实现一个端点，状态灯从"端口通了"升级为"应用自报健康"。未实现自动降级。**这份契约是真正的长期资产：UI 可以重写三次，契约会留下来，v2 门户直接复用。**
3. **menu bar UI** — 一排状态灯，点击启动，就绪后自动开浏览器，右键停止 / 日志 tail。不做 dashboard 页面。
4. **状态认领** — 状态灯只反映探测结果，不反映"是不是 Arborist 启动的"。因此 Arborist 自身重启后无需迁移任何状态，重新轮询即完成认领，成本为零。

## 三类 app 与管理深度

| 类型 | 例子 | 深度 |
|---|---|---|
| `web` | Ametrine、Ginko | 全生命周期：启动（独立进程组）、就绪探测、开浏览器、停止（TERM 进程组 → 5s → KILL）、日志 |
| `app` | Hertz、Axiforge | 统一入口：`open` + 运行状态 + 图标，不深管 |
| `menubar` | Thistelles、ministat、sidereal-desk | 开关 + login item 管理 |

Arborist 自己也注册进自己（`type = "menubar"`）——这是 manifest 设计够不够用的第一块试金石。

## 初始注册表

重组后生态的真实地图，八行：

| app | type | 备注 |
|---|---|---|
| Ametrine | web | FastAPI，有 dev.sh |
| Hertz | app | 以成品形态启动（Electron + Python） |
| Axiforge | app | Electron |
| Ginko | web | 确认存活后再注册 |
| Thistelles | menubar | uv |
| ministat | menubar | Electron |
| sidereal-desk | menubar | TS |
| Arborist | menubar | 自己管自己 |

## 决策记录

1. **产品模式，不是开发模式。** 打开中控台的心理动词是"用"，不是"继续开发"。因此不管环境构建、依赖重建、数据库迁移；Hertz 这类重项目的迁移在它自己的启动脚本里解决。
2. **manifest 约定，不是自动扫描。** 扫描判定信号弱（有 package.json 算可启动吗？）、学习仓库全是噪音、每种技术栈一套推断规则维护成本高。manifest 注册一次 30 秒，零误判。发现机制是确定性的：只在配置的 roots 目录第一层子目录里寻找 `app.toml` 文件本身，不做任何推断。
3. **menu bar 常驻，不是 web 门户。** 门户有鸡生蛋问题（还得先启动门户），且依赖生态存活率。门户降级为 v2，消费同一契约。
4. **main 分支纪律。** web 类 app 从源码启动，"用成品"的前提是 checkout 稳定：manifest 声明 `branch = "main"`，不在 main 就黄灯拒启。开发在分支上做，合并即发布。
5. **状态 = 健康检查轮询。** 由此状态认领免费（见组成部分 4）。
6. **CLI 类 app 不进 v1。** 跑完就退的工具，"启动"这个词不成立；有真实需求再议。
7. **成员一律平级。** Hertz 等只是注册表里的一行，中控台不为核心成员做特殊逻辑。
8. **技术栈 Electron。** 复用 ministat 的 electron-vite + TypeScript + electron-builder 套路，Tray / BrowserWindow / child_process 全是最老牌稳定的 API，零 native 模块、运行时依赖仅一个 toml 解析库。代价是 ~200MB 常驻内存，决策时已接受。实现路线见 [PLAN.md](PLAN.md)。

## 明确不做（v1）

- 目录扫描 / 自动发现推断
- 环境构建、依赖管理、数据库迁移
- 远程主机（不做 homelab dashboard）
- web 仪表盘、全局搜索、快捷操作（每项本质都是对成员 app 的集成开发，等 ≥3 个 app 实现 status 契约后再议）
- git 状态、依赖漂移、版本管理器集成

## 开放决定

（无——技术栈已定为 Electron，见决策记录 8；实现路线见 [PLAN.md](PLAN.md)。）

## 门户（v0.2.0 已交付）

蓝图里 Grove 仪表盘的第一版以"门户"形态落地：Arborist 在 `127.0.0.1:8790` 托管单文件门户页，消费与托盘面板同一份状态（`GET /api/apps`），卡片 + 状态灯 + 深链 + 按时间变化的氛围背景 + 断连优雅降级。原"浏览器第一页"的心愿就此闭环，且没有引入第二套部署——门户跟着 launcher 走。

安全边界：所有 `/api/*` 要求 `X-Arbor: 1` 自定义头，服务端永不批准 CORS 预检，浏览器里的恶意页面因此无法跨源调用（自定义头必过预检）；服务只绑 127.0.0.1。

后续（backlog）：`/api/arbor/search` 全局搜索、`/api/arbor/actions` 快捷操作——新端点只加不改，status 的三个字段仍是冻结契约。
