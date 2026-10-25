# /api/arbor/status — 成员 app 状态契约

**可选**实现。实现了的 app，状态灯从"端口通了"升级为"应用自报健康"，并能展示一行状态文案；未实现的自动降级为 [manifest 的就绪探测](app-toml.md)。实现成本约 30 分钟，是成员 app 对生态唯一的义务。

这份契约是 Arborist 体系的长期资产：v2 浏览器门户消费的就是它，UI 可以重写，契约不推翻。

## 请求

```
GET /api/arbor/status
```

- 由 Arborist 服务端发起（无 CORS 问题），轮询间隔 ≥ 10s。
- 响应应 < 1KB、< 500ms，必须无副作用、无需认证。
- 服务只监听 127.0.0.1，不暴露到网络。

## 响应

`200 OK · application/json`

```json
{
  "state": "ok",
  "line": "3 docs indexed · 2 active sessions",
  "url": "http://127.0.0.1:8710/chat"
}
```

| 字段 | 必填 | 含义 |
|---|---|---|
| `state` | ✅ | `ok` / `starting` / `degraded` / `error` |
| `line` | — | 一行状态文案，显示在 tooltip / 未来门户卡片上 |
| `url` | — | 点击时打开的深链，覆盖 manifest 的 `url` |

**state 语义**

- `ok` — 正常服务
- `starting` — 进程在，还没就绪
- `degraded` — 可用但有异常（离线模型、降级运行等），原因写进 `line`
- `error` — 不可用，原因写进 `line`

三个字段是**冻结契约**：只加不改。未来扩展通过新字段或新端点。

## 降级链

```
/api/arbor/status（若实现）→ manifest.ready 探测 → 灰灯（未注册探测）
```

## 未来端点（v2 门户，现在不实现）

- `GET /api/arbor/search?q=` — 全局搜索
- `POST /api/arbor/actions/...` — 快捷操作（写入类）

等 ≥3 个成员 app 实现了 status，再启动这些扩展。
