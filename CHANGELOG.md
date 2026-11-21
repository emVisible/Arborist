# Changelog

## 0.4.0 — 2026-11-15

主题：开机即绿——登录后自动起身，安静把该亮的灯点亮。

- **web 成员自启**：`app.toml` 新增 `autostart`（仅 web）。Arborist 启动后延迟 2s，按 name 顺序每 1s 静默拉起；不抢浏览器焦点，已在跑只认领，分支/端口异常照常 `blocked` 并在 line 说明。只点火，不守护：手动 stop 后不自动重启
- **自身登录项去重**：self manifest 去掉 `login = true`，Arborist 自启统一由面板 footer 的原生开关管理，避免和卡片右键的 System Events 路径重复
- **登录 PATH**：web 启动命令继承用户登录 shell 的 `PATH`（`$SHELL -lic` 取一次，失败回退）。登录项启动的 GUI app 默认只有系统 PATH，不修的话来自 shell profile 的 `node` / `pnpm` / `uv` 在开机自启时会找不到
- **停止安全**：`blocked` / `error` 状态不再按端口兜底击杀——端口上的进程未必属于这个成员，只清自己的 pidfile。避免 Ametrine 被别的服务占着 8000 时点「停止」误杀占用者
- 文档补齐 `autostart` 字段与「自启与静默」约定；测试 54 个（+9）

## 0.3.1 — 2026-11-13

- **修复**：并发点击「启动」会双开——branch / 端口检查到 spawn 之间新增 in-flight 守卫，第二次点击直接忽略；补并发回归用例
- **修正**：M10 端口冲突验收从「2s」改为「最坏 3s」（契约 1.5s + ready 1.5s），并补「只连不答」占用者用例
- 测试 45 个（+2）

## 0.3.0 — 2026-11-12

主题：端口诚实——启动不再盲目 spawn 后等超时。

- **启动前体检**：web 类 `start` 先查 `url` 端口——已在运行则认领（不双开、照常开浏览器）；被占则立刻 `blocked` 并在 line 点名端口 / PID / 命令，不再白等 60–180s 超时；残留实例的清理走既有「停止」的端口兜底击杀
- **门户端口失败可见**：8790 被占时面板顶部 banner 说明原因（此前只有打包后看不见的 console 日志）
- 测试 43 个（+3）

## 0.2.1 — 2026-11-12

主题：成员接入收尾——真实生态齐三类，操作面补两个兜底入口。

- **成员**：Hertz（app）接入；Thistelles / MiniStat 走 `~/.arborist/members/` 清单目录接入。v1 验收的「三类 app 各至少一个真实成员」到此满足
- **`start_timeout_ms`**：启动预算由成员在 `app.toml` 里自己声明（如 Ametrine 冷启动 180s），不再只有全局 60s 缺省；慢启动被 watchdog 打成 error 后，就绪仍会自动开浏览器
- **全局快捷键 `⌥⌘A`**：菜单栏满时托盘图标会被挤到刘海下，快捷键是兜底入口（config `hotkey` 可改，重启生效）
- **自身 manifest 声明应用图标**：门户与面板不再显示字母占位
- **门户卡片**：状态文案不再重复渲染
- **`pnpm dev`**：保留 Dock 图标并在启动时自动打开面板（打包版仍是纯菜单栏）
- 测试 40 个

## 0.2.0 — 2026-10-26

主题：Portal 与感知——把状态送出去，让灯变诚实。

- **本地 API + 门户**：`http://127.0.0.1:8790/`（config `port` 可改）。门户为无构建单文件页：卡片网格、5s 刷新、按一天时间变化的背景氛围、断连遮罩优雅降级；web 卡直开 URL，app/menubar 卡经 API 拉起。所有 `/api/*` 要求 `X-Arbor` 头（永不批准 CORS 预检 → 跨源 CSRF 被挡死）
- **app/menubar 运行态检测**：进程名走 `pgrep -x`（零权限），bundle id 走 `lsappinfo`，约 15s 慢轮询，灯在灰/绿间诚实切换
- **托盘告警**：任一 app error 时托盘图标切红点告警样式，恢复自动切回
- **右键"重启"**（web 类）、面板显示未注册 repo 计数
- 新增 `pnpm preview:portal` 门户预览；测试 36 个

## 0.1.0 — 2026-10-26

v1 首发：menu bar 常驻的个人 app 中控台。

- **注册表**：`~/.arborist/config.toml` 配置 roots，各 repo 根目录放 `app.toml` 即注册
- **web 类全生命周期**：进程组启动/整组击杀、三级就绪探测（status 契约 → ready → tcp）、就绪自动开浏览器、启动超时判定、分支纪律（非 main 黄灯拒启）、崩溃重启后状态认领
- **app / menubar 类**：`open` 启动、登录项读写（System Events，权限被拒时降级打开系统设置）
- **UI**：状态灯列表、右键菜单（启动/停止/打开/日志/Finder）、日志窗口实时 tail、Esc 隐藏
- **工程**：30 个测试（含进程树击杀与完整生命周期集成测试）、`pnpm preview:ui` 浏览器调 UI、dmg 打包
