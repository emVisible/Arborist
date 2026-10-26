# Arborist 交接文档

写给接手的 agent。你没有任何前情对话上下文，本文档 + 仓库里的既有文档就是全部背景。**按顺序读**：`README.zh-CN.md` → `PROJECT.md`（设计决策记录，必读）→ `PLAN.md`（v1 与 v0.2 的里程碑，含验收标准）→ 本文档。契约规范在 `docs/app-toml.md` 和 `docs/arbor-status.md`。

## 项目是什么

Arborist 是主人（emVisible，本地用户 `young`）的个人 app 中控台：常驻 macOS menu bar 的 Electron 应用，管理他自己开发的一批小软件（web 服务 / 桌面应用 / menu bar 守护三类）。它是《The Grove 个人数字生态蓝图》中 Grove 模块的落地形态——中控台先行，浏览器门户已随 v0.2.0 交付。定位一句话：**管点火，不管聚合；产品模式，不是开发模式**。

当前状态：**v0.2.0 完成并已推送**（HEAD 见 `git log`，dmg 在 `release/Arborist-0.2.0-arm64.dmg`）。36 个测试全绿。真实注册表里目前只有 Arborist 自己（自注册），主人尚未给其它 app 放 manifest——这是当前最大的空转点。

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
tests/              7 文件 36 用例
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

## 主人的生态背景（接活时对齐用）

- 活跃 app：Ametrine（web，FastAPI，repo 有 dev.sh，正在重构）、Hertz（Electron 桌面平台，最活跃）、Axiforge（Electron）、Ginko（存疑）；menu bar 类：Thistelles、ministat、sidereal-desk。
- `~/Code` 是源码根（当前 7 个未注册目录）；游戏项目在 `~/Game`。
- 蓝图（Ginkgo 成就/Pota AI 中台/Canopy 社区/Nexus 笔记/Zap 工具包）大部分未建或放弃，Arborist 只关心"活着的成员"。

## 下一步（按建议优先级）

**主人侧空转点（最优先推动，代码之外）**：给 Ametrine/Hertz/Axiforge/Thistelles 等 repo 放 `app.toml` 注册进真盘子；给 Ametrine 实现 `GET /api/arbor/status`（约半小时，规范见 docs/arbor-status.md）。门户与面板的价值随真实成员数线性上升。

**v0.3 候选（动手前先和主人对齐）**：
1. `/api/arbor/search` 全局搜索 + 门户搜索框——前置条件：≥3 个成员实现 status 契约。
2. 端口冲突仲裁（当前行为：探测超时→红灯，日志可解释）。
3. 自动更新（个人用，可先做"检查 GitHub release 提示"轻量版）。
4. Playwright E2E。
5. v1 遗留手工回归项：Hertz 一键打开、Thistelles 登录项开关真实验证（需要主人在场授权 System Events）。

**修 bug 时的锚点**：状态机转移全在 `manager.ts` 的 `applyProbe`/`poll`；停止语义在 `supervisor.ts`；灯色映射 CSS 在 `app.css` 与 `resources/portal/index.html` 两处（改动要同步）。
