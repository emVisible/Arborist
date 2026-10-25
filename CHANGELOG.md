# Changelog

## 0.1.0 — 2026-10-26

v1 首发：menu bar 常驻的个人 app 中控台。

- **注册表**：`~/.arborist/config.toml` 配置 roots，各 repo 根目录放 `app.toml` 即注册
- **web 类全生命周期**：进程组启动/整组击杀、三级就绪探测（status 契约 → ready → tcp）、就绪自动开浏览器、启动超时判定、分支纪律（非 main 黄灯拒启）、崩溃重启后状态认领
- **app / menubar 类**：`open` 启动、登录项读写（System Events，权限被拒时降级打开系统设置）
- **UI**：状态灯列表、右键菜单（启动/停止/打开/日志/Finder）、日志窗口实时 tail、Esc 隐藏
- **工程**：30 个测试（含进程树击杀与完整生命周期集成测试）、`pnpm preview:ui` 浏览器调 UI、dmg 打包
