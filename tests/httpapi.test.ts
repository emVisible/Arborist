import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { startApiServer, type ApiManager } from '../src/main/core/httpapi'
import { freePort } from './helpers'

const servers: Array<{ close(): Promise<void> }> = []
const dirs: string[] = []

afterEach(async () => {
  for (const s of servers.splice(0)) await s.close()
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

function stubManager(): ApiManager & { calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    list: () => ({
      apps: [
        {
          name: 'fixture-web',
          title: 'Fixture',
          type: 'web' as const,
          state: 'stopped' as const,
          url: 'http://127.0.0.1:1'
        }
      ],
      errors: []
    }),
    start: async (name: string) => {
      calls.push(`start:${name}`)
    },
    stop: async (name: string) => {
      calls.push(`stop:${name}`)
    },
    open: (name: string) => {
      calls.push(`open:${name}`)
    }
  } as ApiManager & { calls: string[] }
}

describe('本地 HTTP API', () => {
  it('无 X-Arbor 头 403，带头 200 返回 app 列表', async () => {
    const port = await freePort()
    const api = await startApiServer(stubManager(), port, '/nonexistent.html')
    servers.push(api)
    const base = `http://127.0.0.1:${api.port}`

    const forbidden = await fetch(`${base}/api/apps`)
    expect(forbidden.status).toBe(403)

    const ok = await fetch(`${base}/api/apps`, { headers: { 'x-arbor': '1' } })
    expect(ok.status).toBe(200)
    const body = (await ok.json()) as { apps: { name: string; url?: string }[] }
    expect(body.apps[0].name).toBe('fixture-web')
    expect(body.apps[0].url).toBe('http://127.0.0.1:1')
  })

  it('POST 动作触发 manager，未知 app 404', async () => {
    const port = await freePort()
    const manager = stubManager()
    const api = await startApiServer(manager, port, '/nonexistent.html')
    servers.push(api)
    const base = `http://127.0.0.1:${api.port}`

    const res = await fetch(`${base}/api/apps/fixture-web/start`, {
      method: 'POST',
      headers: { 'x-arbor': '1' }
    })
    expect(res.status).toBe(202)
    expect(manager.calls).toEqual(['start:fixture-web'])

    const missing = await fetch(`${base}/api/apps/nope/open`, {
      method: 'POST',
      headers: { 'x-arbor': '1' }
    })
    expect(missing.status).toBe(404)
  })

  it('GET / 返回门户 HTML', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'arborist-api-'))
    dirs.push(dir)
    const html = join(dir, 'index.html')
    writeFileSync(html, '<!doctype html><p>portal</p>')

    const port = await freePort()
    const api = await startApiServer(stubManager(), port, html)
    servers.push(api)

    const res = await fetch(`http://127.0.0.1:${api.port}/`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/html')
    expect(await res.text()).toContain('portal')
  })

  it('close 后连接拒绝', async () => {
    const port = await freePort()
    const api = await startApiServer(stubManager(), port, '/nonexistent.html')
    const base = `http://127.0.0.1:${api.port}`
    await api.close()
    await expect(fetch(`${base}/api/apps`, { headers: { 'x-arbor': '1' } })).rejects.toThrow()
  })
})
