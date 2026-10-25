import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { readFileSync } from 'node:fs'
import type { AppManager } from './manager'

export type ApiManager = Pick<AppManager, 'list' | 'start' | 'stop' | 'open'>

export interface ApiServer {
  server: Server
  port: number
  close(): Promise<void>
}

// 本地 API + 门户宿主：只绑 127.0.0.1。
// 所有 /api/* 要求自定义头 X-Arbor: 1——跨源页面发自定义头必须过 CORS 预检，
// 本服务永不批准预检（不带 CORS 响应头），CSRF 因此被挡死；门户与 API 同源不受影响。
export function startApiServer(
  manager: ApiManager,
  port: number,
  portalHtmlPath: string
): Promise<ApiServer> {
  const server = createServer((req, res) => {
    void handle(req, res, manager, portalHtmlPath)
  })

  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', () => {
      server.removeListener('error', reject)
      resolve({
        server,
        port: (server.address() as { port: number }).port,
        close: () =>
          new Promise<void>((r) => {
            server.close(() => r())
          })
      })
    })
  })
}

async function handle(
  req: IncomingMessage,
  res: ServerResponse,
  manager: ApiManager,
  portalHtmlPath: string
): Promise<void> {
  try {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')

    if (req.method === 'GET' && url.pathname === '/') {
      const html = readFileSync(portalHtmlPath, 'utf8')
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(html)
      return
    }

    if (url.pathname.startsWith('/api/')) {
      if (req.headers['x-arbor'] !== '1') {
        res.writeHead(403).end('forbidden')
        return
      }

      if (req.method === 'GET' && url.pathname === '/api/apps') {
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify(manager.list()))
        return
      }

      const action = url.pathname.match(/^\/api\/apps\/([a-z0-9-]+)\/(start|stop|open)$/)
      if (req.method === 'POST' && action) {
        const name = action[1]
        if (!manager.list().apps.some((a) => a.name === name)) {
          res.writeHead(404).end('unknown app')
          return
        }
        if (action[2] === 'start') await manager.start(name)
        else if (action[2] === 'stop') await manager.stop(name)
        else manager.open(name)
        res.writeHead(202).end()
        return
      }

      res.writeHead(404).end()
      return
    }

    res.writeHead(404).end()
  } catch {
    res.writeHead(500).end()
  }
}
