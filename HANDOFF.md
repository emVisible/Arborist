# Arborist 交接文档

写给接手的 agent。你没有任何前情对话上下文，本文档 + 仓库里的既有文档就是全部背景。**按顺序读**：`README.zh-CN.md` → `PROJECT.md`（设计决策记录，必读）→ `PLAN.md`（v1 与 v0.2 的里程碑，含验收标准）→ 本文档。契约规范在 `docs/app-toml.md` 和 `docs/arbor-status.md`。

## 项目是什么

Arborist 是主人（emVisible，本地用户 `young`）的个人 app 中控台：常驻 macOS menu bar 的 Electron 应用，管理他自己开发的一批小软件（web 服务 / 桌面应用 / menu bar 守护三类）。它是《The Grove 个人数字生态蓝图》中 Grove 模块的落地形态——中控台先行，浏览器门户已随 v0.2.0 交付。定位一句话：**管点火，不管聚合；产品模式，不是开发模式**。

当前状态：**v0.2.0 完成并已推送**（HEAD 见 `git log`，dmg 在 `release/Arborist-0.2.0-arm64.dmg`）。37 个测试全绿。

真实注册表有 **四个成员**：Arborist 自注册 + **Ametrine**（web，橙 `degraded`）+ **Thistelles**（menubar，绿）+ **MiniStat**（menubar，灰）。后两个住新开的「清单目录」`~/.arborist/members/<name>/app.toml`（PROJECT.md 决策 9，零代码改动）；Ametrine 侧的 5 个文件**尚未提交**（主人 repo 里有自己的未提交改动）。细节与实测证据见「成员接入」。

## 架构速览

```
src/main/core/      纯 Node 核心逻辑（零 Electron import → vitest 可直接集成测试）
  config.ts         ~/.arborist/config.toml 加载（roots / poll_interval_ms / port）
  registry.ts       roots 第一层子目录扫 app.toml，解析校验，统计未注册数
  manager.ts        状态机与轮询中枢（web 全生命周期 + app/menubar 慢轮询 + 事件总线）
  supervisor.ts     进程组 spawn/组杀（TERM→5s→KILL）、pidfile、端口兜底击杀、git 分支检查
  prober.ts         三级就绪探测：/api/arbor/status 契约 → manifest.ready → tcp
  openers.ts        open -a/-b 启动 + pgrep/lsappinfo 运行态检测
  loginitems.ts     System Events osascript 登录项读写（权限被拒抛 AutomationError 降级）
  httpapi.ts        本地 API + 门户宿主（127.0.0.1:8790，X-Arbor 头防跨源 CSRF）
src/main/           Electron 壳：index.ts / tray.ts（含告警图标切换）/ window.ts / ipc.ts
src/preload/        contextBridge 白名单 API（window.arbor）
src/renderer/src/   React dropdown 面板 + LogView + mock.ts（浏览器预览用）
src/shared/types.ts 前后端共享类型
resources/portal/   门户页（无构建单文件 HTML，时间氛围主题）
scripts/            gen-icons.mjs（零依赖 PNG 编码器）/ preview 两件套
fixtures/           spawn-tree.sh / serve.mjs（集成测试夹具）
tests/              7 文件 37 用例
```

数据流：registry 发现 → manager 持状态机 → poll 驱动灯色 → 事件 `update`/`refresh` 广播到托盘面板与门户。状态不持久化（认领 = 重启后重新轮询）。

## 不可推翻的决策（详见 PROJECT.md 决策记录 1–8）

1. 产品模式：不管环境构建/依赖/迁移；web 服务限定 main 分支启动（`branch` 黄灯拒启）。
2. manifest 约定，不做扫描推断（roots 下找 `app.toml` 文件本身是确定性查找）。
3. menu bar 常驻为主形态；门户是同源消费端，不做第二套部署。
4. 运行时 npm 依赖白名单：**仅 smol-toml**。新增任何依赖都需要充分理由。
5. 状态 = 健康检查轮询结果，不记录"谁启动的"。
6. CLI 类 app 不进注册表（跑完即退，无"启动"语义）。
7. 成员一律平级，无特殊逻辑。
8. 本地 API 的 `X-Arbor` 头防线与"永不批准 CORS 预检"不可拆。

## 工作纪律（主人明确的协作方式）

- **先计划后动手**：大改动先在 PLAN.md 落盘里程碑（M 编号 + 验收标准），再逐里程碑实现。每个里程碑独立验收、独立提交，commit 风格 `M6: xxx — yyy`（英文简述）。
- **验收三件套全绿才提交**：`pnpm typecheck && pnpm test && pnpm build`。注意：把 `pnpm test` 接管道 `tail` 会吞掉失败退出码，别这么写。
- 文档语言：设计记录/计划/CHANGELOG 用中文，README 中英双份同步改。
- lean 原则：注释/文档/测试都要挣得自己的位置，反对过度产出；backlog 用编号防漂移（见 PLAN.md §9）。
- 主人喜欢在动手前被 grill（对方案提尖锐问题），重大方向先对话再写码。
- 与主人交流用中文。

## 常用命令（都在 `/Users/young/Code/Arborist` 下执行）

```
pnpm dev            # 源码运行（会真启动 GUI，谨慎在无人值守时用）
pnpm typecheck && pnpm test && pnpm build
pnpm preview:ui     # 浏览器调 dropdown UI（mock 数据，不起 Electron）
pnpm preview:portal # 浏览器调门户页（假数据，端口 5178）
pnpm dist           # 打 dmg（必须带镜像环境变量，见下）
node scripts/gen-icons.mjs   # 重新生成托盘/应用图标（改图标后必须跑）
```

冒烟（打包后端到端）：启动 `./release/mac-arm64/Arborist.app/Contents/MacOS/Arborist`，等 6 秒，`curl -H "X-Arbor: 1" http://127.0.0.1:8790/api/apps` 应返回 JSON（含 arborist 自身），无头 curl 应 403，`curl http://127.0.0.1:8790/` 应返回门户 HTML，然后 kill 进程。

## 本机环境地雷（前一个 agent 实测踩过，务必照做）

1. **GitHub release 下载被网络拦截**：装依赖/打包必须带 `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/`。若 `node_modules/electron/dist` 缺失：`ELECTRON_MIRROR=... node node_modules/electron/install.js`。
2. **pnpm 10 默认拦截 postinstall**：package.json 已配 `pnpm.onlyBuiltDependencies`（electron/esbuild）；换机器或重装后注意 electron 二进制是否真的就位。
3. **git push 到 GitHub 间歇性失败**（HTTP2 framing / 连不上）：重试即可，必要时 `git -c http.version=HTTP/1.1 push`。gh api 可用于探连通性。
4. **被 SIGKILL 的拷贝版 Apple 签名二进制会卡在 UE（exiting）状态不被回收，pgrep 永远可见**：测试夹具禁止 cp 二进制，用 symlink 指向 `/bin/sleep`（见 `tests/openers.test.ts` 注释）。进程名夹具须 ≤15 字符（p_comm 截断）且带 pid 保证跨运行唯一。
5. shell 工具的 cwd 可能被重置回 `/Users/young/Code`，命令里显式 `cd /Users/young/Code/Arborist`。
6. **Vite 在 macOS 把 `localhost` 解析成 IPv6，只监听 `[::1]`**：manifest 写 `http://127.0.0.1:8000` 就必须让前端显式绑 IPv4（`pnpm dev --host=127.0.0.1`；写成 `pnpm dev -- --host=...` 时 pnpm 会把 `--` 原样交给 vite，参数等于没传）。症状是「浏览器打开 localhost:8000 一切正常，中控台灯永远不绿」，2026-10-26 实测踩过。
7. **Ametrine 冷启动 75–120s**（torch 导入），而启动 watchdog 是 60s（`manager.ts` 的 `opts.startTimeoutMs ?? 60_000`）。所以现在每次点启动都会先显示「启动超时（60s 未就绪）」，再被轮询自愈成橙/绿。自愈时 `prev` 已不是 `starting` 导致不开浏览器的那一半**已修**（带用例，见 git log 的 manager fix）；剩下的「每次启动先闪一下超时红字」要主人定档（per-manifest `start_timeout` vs 抬高默认值），别默默改契约。

## 主人的生态背景（接活时对齐用）

- 活跃 app：Ametrine（web，FastAPI，repo 有 dev.sh，正在重构）、Hertz（Electron 桌面平台，最活跃）、Axiforge（Electron）、Ginko（存疑）；menu bar 类：Thistelles、ministat、sidereal-desk。
- `~/Code` 是源码根（当前 7 个未注册目录）；游戏项目在 `~/Game`。
- 蓝图（Ginkgo 成就/Pota AI 中台/Canopy 社区/Nexus 笔记/Zap 工具包）大部分未建或放弃，Arborist 只关心"活着的成员"。

## 成员接入（2026-10-26 实测）

**Ametrine 已注册为 web 成员**，改动落在它自己的 repo，**全部未提交**（Ametrine 有主人自己的未提交改动；版本号与 CHANGELOG 的升档是他的事）。五个文件：

- `app.toml`（新增）—— 见 `docs/app-toml.md` 的实例，那份就是这台机器上真的在跑的
- `arborist-start.sh`（新增，+x）—— 产品入口：前台拉起后端 :3000 与前端 :8000，任一头掉了就整体退出；不装依赖、不跑迁移、不起 Docker（决策 1）。与 `dev.sh`（给人用的 tmux 开发编排）刻意分工
- `apps/backend/src/system/arbor.py`（新增）—— `GET /api/arbor/status` 契约。两处形状要求破了不会报错、只会静默失效，都写在文件头注释里：默认响应类 `IResponse` 会把 dict 包进 `{code,message,data}` 信封（所以必须显式 `JSONResponse`）；`Depends(get_redis)` 在 Redis 死时自己抛异常变成 500 信封（所以三项检查在函数体内自己做）
- `apps/backend/main.py`、`apps/backend/src/middleware/tags.py` —— 各一行接线

实测证据（不是我推断的）：以 supervisor 同样的方式（detached 独立进程组 + 日志落盘）跑 `arborist-start.sh` → 3000/8000 起来 → `probeApp()` 返回 `source: 'contract'`、`state: 'degraded'`、line 点名 `redis/milvus` → 组杀后 IPv4 端口无监听、无残留进程。验证用的是临时探针测试，跑完已删，不在树里；重跑办法：把 `discoverApps(['~/Code'])` 与 `probeApp()` 在栈起来时调一次。

**Thistelles / MiniStat 走清单目录接入**（PROJECT.md 决策 9）：`~/.arborist/config.toml` 的 roots 加了 `~/.arborist/members`，两个成员各一份 `app.toml` + 从 `.app` 包 sips 出来的 128px `icon.png`。零代码改动——发现机制本来就只认「root 的第一层子目录里有 app.toml」。同样用真代码路径验过：`loadConfig()` → `discoverApps()` 得到 4 个成员、0 解析错误、未注册 6；`appRunning()` 正反对照：Thistelles（此刻在跑）= true、MiniStat（没跑）= false。**托盘里点一次「重扫」即可看到 4 个成员**（`rescan()` 会重新读 config，不需要重启）。

**其余活跃成员别按「放个 app.toml 就行」估工**（交接文档上一版就是这么写的）：

| 成员 | 这台机器上的现实 | 还缺 |
|---|---|---|
| Hertz | `.app` 只在 `electron/release/mac-arm64/`（2026-09-23 的 v0.30，仓库已 v0.37），未安装；LaunchServices 里 `ai.hertz.app` 指向 `/private/tmp/hertz_dmg_mnt` 一类已消失路径 | 重新构建并安装，或主人改注册方式 |
| Axiforge | Tauri 桌面从未构建（全仓 0 个 `.app`），只有 `pnpm dev:desktop` | 构建产物 |
| Thistelles | 源码仓不在本机（uv receipt 指向已删除的 `~/Code/Thistelles`），只有 `/Applications` 里的成品在跑 → **已接入清单目录** | 已接入；`open` 必须写 `com.thistelles.app`，因为打包后的进程名是 `PythonRuntime`，`pgrep -x Thistelles` 匹配不到 |
| MiniStat | 同上 | 已接入（`com.ministat.app`）；没声明 `login`，登录项状态仍归主人自己管 |
| Ametrine 想真绿 | 需要 Redis 与 Milvus。本机关系库是 Homebrew 原生实例（`.env` 写 `postgresql+asyncpg://young@localhost:5432`），而 compose 想在 5432 起 pgvector 容器 —— **跟原生实例撞端口**，所以启动脚本不碰数据层 | 主人定：数据层以什么方式常驻 |

## 下一步（按建议优先级）

**待主人定档（上面表格里「还缺」那列都是决定，不是工时）**：数据层常驻方式、Hertz/Axiforge 是装成品还是换注册方式、启动 watchdog 60s 与 Ametrine 冷启动 75–120s 的冲突怎么修（见环境地雷第 7 条）。

**v0.3 候选（动手前先和主人对齐）**：
1. `/api/arbor/search` 全局搜索 + 门户搜索框——前置条件：≥3 个成员实现 status 契约。
2. 端口冲突仲裁（当前行为：探测超时→红灯，日志可解释）。
3. 自动更新（个人用，可先做"检查 GitHub release 提示"轻量版）。
4. Playwright E2E。
5. v1 遗留手工回归项：Hertz 一键打开、Thistelles 登录项开关真实验证（需要主人在场授权 System Events）。

**修 bug 时的锚点**：状态机转移全在 `manager.ts` 的 `applyProbe`/`poll`；停止语义在 `supervisor.ts`；灯色映射 CSS 在 `app.css` 与 `resources/portal/index.html` 两处（改动要同步）。
