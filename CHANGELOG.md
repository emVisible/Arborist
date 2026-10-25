# Changelog

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
