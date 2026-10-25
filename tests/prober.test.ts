import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { closeSync, openSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { probeApp } from '../src/main/core/prober'
import type { Manifest } from '../src/main/core/registry'
import { freePort } from './helpers'

const servers: http.Server[] = []
const dirs: string[] = []
afterEach(() => {
  for (const s of servers.splice(0)) s.close()
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

function startServer(handler: http.RequestListener): Promise<{ url: string; port: number }> {
  const server = http.createServer(handler)
  servers.push(server)
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo
      resolve({ url: `http://127.0.0.1:${port}`, port })
    })
  })
}

const manifest = (url: string, ready?: string): Manifest => ({
  name: 't',
  title: 't',
  type: 'web',
  repoDir: '/tmp',
  url,
  ready
})

describe('prober 降级链', () => {
  it('契约优先：解析 state/line', async () => {
    const { url } = await startServer((req, res) => {
      if (req.url === '/api/arbor/status') {
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ state: 'degraded', line: '模型离线' }))
      } else {
        res.writeHead(200).end('ok')
      }
    })
    const p = await probeApp(manifest(url), 1000)
    expect(p).toMatchObject({ reachable: true, state: 'degraded', line: '模型离线', source: 'contract' })
  })

  it('无契约时降级到 ready 探测', async () => {
    const { url } = await startServer((req, res) => {
      res.writeHead(req.url === '/healthz' ? 200 : 404).end()
    })
    const p = await probeApp(manifest(url, 'http:/healthz'), 1000)
    expect(p).toMatchObject({ reachable: true, source: 'ready' })
  })

  it('ready 路径 404 → 不可达', async () => {
    const { url } = await startServer((req, res) => {
      res.writeHead(404).end()
    })
    const p = await probeApp(manifest(url, 'http:/healthz'), 1000)
    expect(p.reachable).toBe(false)
  })

  it('ready 支持绝对 URL 与 tcp 兜底', async () => {
    const a = await startServer((req, res) => res.writeHead(200).end())
    const b = await startServer(() => {
      /* 不响应 HTTP 语义也不影响 tcp 探测 */
    })
    const abs = await probeApp(manifest(a.url, `${a.url}/ready`), 1000)
    expect(abs.source).toBe('ready')
    expect(abs.reachable).toBe(true)

    const tcp = await probeApp(manifest(b.url, 'tcp'), 1000)
    expect(tcp).toMatchObject({ reachable: true, source: 'tcp' })
  })

  it('端口未开 → 不可达', async () => {
    const port = await freePort() // 拿到即释放，端口无人监听
    const p = await probeApp(manifest(`http://127.0.0.1:${port}/`, 'http:/healthz'), 800)
    expect(p.reachable).toBe(false)
  })

  it('无 url 的 manifest 返回 none', async () => {
    const d = mkdtempSync(join(tmpdir(), 'arborist-probe-'))
    dirs.push(d)
    closeSync(openSync(join(d, 'keep'), 'w'))
    const p = await probeApp(manifest(''), 100)
    expect(p.source).toBe('none')
  })
})
