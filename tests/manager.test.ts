import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppManager } from '../src/main/core/manager'
import { freePort, waitFor } from './helpers'

const sh = promisify(execFile)
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const serveFixture = join(repoRoot, 'fixtures/serve.mjs')

const junk: {
  dirs: string[]
  managers: AppManager[]
  children: ReturnType<typeof spawn>[]
  servers: Server[]
} = {
  dirs: [],
  managers: [],
  children: [],
  servers: []
}

function tmp(): string {
  const d = mkdtempSync(join(tmpdir(), 'arborist-mgr-'))
  junk.dirs.push(d)
  return d
}

function fixtureSetup(start: string, port: number, extra = ''): {
  home: string
  base: string
  root: string
  configPath: string
  url: string
} {
  const home = tmp()
  const base = tmp()
  const root = tmp()
  const repo = join(root, 'fixture-web')
  mkdirSync(repo, { recursive: true })
  writeFileSync(
    join(repo, 'app.toml'),
    `name = "fixture-web"\ntitle = "Fixture Web"\ntype = "web"\nstart = "${start}"\nurl = "http://127.0.0.1:${port}"\nready = "http:/healthz"\n${extra}`
  )
  const configPath = join(home, 'config.toml')
  mkdirSync(home, { recursive: true })
  writeFileSync(configPath, `roots = ["${root}"]\npoll_interval_ms = 500\n`)
  return { home, base, root, configPath, url: `http://127.0.0.1:${port}` }
}

function makeManager(
  configPath: string,
  base: string,
  overrides: Record<string, unknown> = {}
): { manager: AppManager; openExternal: ReturnType<typeof vi.fn> } {
  const openExternal = vi.fn()
  const manager = new AppManager({
    configPath,
    baseDir: base,
    pollIntervalMs: 200,
    startTimeoutMs: 6000,
    openExternal,
    ...overrides
  })
  junk.managers.push(manager)
  return { manager, openExternal }
}

function stateOf(m: AppManager): string | undefined {
  return m.list().apps.find((a) => a.name === 'fixture-web')?.state
}

afterEach(() => {
  for (const m of junk.managers.splice(0)) m.dispose()
  for (const c of junk.children.splice(0)) c.kill('SIGKILL')
  for (const s of junk.servers.splice(0)) {
    s.closeAllConnections()
    s.close()
  }
  for (const d of junk.dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

describe('manager web 生命周期', () => {
  it('start → running（契约 line）→ 自动开浏览器 → stop → stopped', async () => {
    const port = await freePort()
    const setup = fixtureSetup(`node ${serveFixture} ${port}`, port)
    const { manager, openExternal } = makeManager(setup.configPath, setup.base)
    await manager.init()
    expect(stateOf(manager)).toBe('stopped')

    await manager.start('fixture-web')
    await waitFor(() => stateOf(manager) === 'running', 8000)
    const app = manager.list().apps.find((a) => a.name === 'fixture-web')
    expect(app?.line).toBe('fixture ok')
    expect(openExternal).toHaveBeenCalledWith(setup.url)

    await manager.stop('fixture-web')
    await waitFor(() => stateOf(manager) === 'stopped', 5000)
  })

  it('认领：外部启动的服务轮询后变 running，不开浏览器，stop 走端口兜底', async () => {
    const port = await freePort()
    const setup = fixtureSetup(`node ${serveFixture} ${port}`, port)
    const child = spawn('node', [serveFixture, String(port)], { stdio: 'ignore' })
    junk.children.push(child)
    await waitFor(
      () => new Promise<boolean>((r) => fetch(setup.url).then(() => r(true), () => r(false))),
      5000
    )

    const { manager, openExternal } = makeManager(setup.configPath, setup.base)
    await manager.init()
    await waitFor(() => stateOf(manager) === 'running', 8000)
    expect(openExternal).not.toHaveBeenCalled()

    await manager.stop('fixture-web')
    await waitFor(() => stateOf(manager) === 'stopped', 8000)
    await waitFor(
      () => new Promise<boolean>((r) => fetch(setup.url).then(() => r(false), () => r(true))),
      5000
    )
  })

  it('start 时服务已在跑：认领、不 spawn、开浏览器', async () => {
    const port = await freePort()
    const setup = fixtureSetup(`node ${serveFixture} ${port}`, port)
    const child = spawn('node', [serveFixture, String(port)], { stdio: 'ignore' })
    junk.children.push(child)
    await waitFor(
      () => new Promise<boolean>((r) => fetch(setup.url).then(() => r(true), () => r(false))),
      5000
    )

    const { manager, openExternal } = makeManager(setup.configPath, setup.base)
    await manager.init()
    await manager.start('fixture-web')

    expect(stateOf(manager)).toBe('running')
    expect(openExternal).toHaveBeenCalledWith(setup.url)
    expect(existsSync(join(setup.base, 'pids', 'fixture-web.pid'))).toBe(false)

    await manager.stop('fixture-web')
    await waitFor(() => stateOf(manager) === 'stopped', 5000)
  })

  it('并发 start 只 spawn 一次（无 EADDRINUSE）', async () => {
    const port = await freePort()
    const setup = fixtureSetup(`node ${serveFixture} ${port}`, port)
    const { manager } = makeManager(setup.configPath, setup.base)
    await manager.init()

    await Promise.all([manager.start('fixture-web'), manager.start('fixture-web')])
    await waitFor(() => stateOf(manager) === 'running', 8000)
    await new Promise((r) => setTimeout(r, 800))

    const log = readFileSync(join(setup.base, 'logs', 'fixture-web.log'), 'utf8')
    expect(log).not.toContain('EADDRINUSE')
    expect(log.match(/listening/g)?.length).toBe(1)

    await manager.stop('fixture-web')
    await waitFor(() => stateOf(manager) === 'stopped', 5000)
  })

  it('start 时端口被占：快速 blocked、点名占用者、不 spawn', async () => {
    const port = await freePort()
    const setup = fixtureSetup(`node ${serveFixture} ${port}`, port)
    const occupant = createServer((_req, res) => res.writeHead(503).end())
    await new Promise<void>((r) => occupant.listen(port, '127.0.0.1', r))
    junk.servers.push(occupant)

    const { manager, openExternal } = makeManager(setup.configPath, setup.base)
    await manager.init()
    await manager.start('fixture-web')

    expect(stateOf(manager)).toBe('blocked')
    const app = manager.list().apps.find((a) => a.name === 'fixture-web')
    expect(app?.line).toContain(String(port))
    expect(app?.line).toContain(String(process.pid))
    expect(existsSync(join(setup.base, 'pids', 'fixture-web.pid'))).toBe(false)
    expect(openExternal).not.toHaveBeenCalled()
  })

  it('apiError：写入后出现在 list 并广播 refresh', async () => {
    const port = await freePort()
    const setup = fixtureSetup(`node ${serveFixture} ${port}`, port)
    const { manager } = makeManager(setup.configPath, setup.base)
    await manager.init()

    const refreshed = vi.fn()
    manager.on('refresh', refreshed)
    manager.setApiError('门户/API 未启动：EADDRINUSE')

    expect(manager.list().apiError).toBe('门户/API 未启动：EADDRINUSE')
    expect(refreshed).toHaveBeenCalledTimes(1)
  })

  it('start 时端口被「只连不答」进程占住：最坏 3s 内 blocked', async () => {
    const port = await freePort()
    const setup = fixtureSetup(`node ${serveFixture} ${port}`, port)
    const occupant = createServer(() => {})
    await new Promise<void>((r) => occupant.listen(port, '127.0.0.1', r))
    junk.servers.push(occupant)

    const { manager, openExternal } = makeManager(setup.configPath, setup.base)
    await manager.init()
    const t0 = Date.now()
    await manager.start('fixture-web')
    const elapsed = Date.now() - t0

    expect(stateOf(manager)).toBe('blocked')
    expect(elapsed).toBeLessThan(4000)
    const app = manager.list().apps.find((a) => a.name === 'fixture-web')
    expect(app?.line).toContain(String(port))
    expect(app?.line).toContain(String(process.pid))
    expect(existsSync(join(setup.base, 'pids', 'fixture-web.pid'))).toBe(false)
    expect(openExternal).not.toHaveBeenCalled()
  }, 10_000)

  it('blocked：非 main 分支黄灯拒启', async () => {
    const port = await freePort()
    const setup = fixtureSetup(`node ${serveFixture} ${port}`, port, 'branch = "main"\n')
    const repo = join(setup.root, 'fixture-web')
    await sh('git', ['-C', repo, 'init', '-q', '-b', 'main'])
    await sh('git', ['-C', repo, '-c', 'user.name=t', '-c', 'user.email=t@t.t', 'commit', '-q', '--allow-empty', '-m', 'x'])
    await sh('git', ['-C', repo, 'checkout', '-q', '-b', 'dev'])

    const { manager } = makeManager(setup.configPath, setup.base)
    await manager.init()
    await manager.start('fixture-web')
    await waitFor(() => stateOf(manager) === 'blocked', 5000)
    const app = manager.list().apps.find((a) => a.name === 'fixture-web')
    expect(app?.line).toContain('分支')
    expect(app?.line).toContain('main')
  })

  it('启动超时 → error', async () => {
    const port = await freePort()
    const setup = fixtureSetup('sleep 30', port)
    const { manager } = makeManager(setup.configPath, setup.base, { startTimeoutMs: 1200 })
    await manager.init()
    await manager.start('fixture-web')
    await waitFor(() => stateOf(manager) === 'error', 6000)
    const app = manager.list().apps.find((a) => a.name === 'fixture-web')
    expect(app?.line).toContain('超时')

    await manager.stop('fixture-web')
    await waitFor(() => stateOf(manager) === 'stopped', 5000)
  })

  it('慢启动：watchdog 先报超时，就绪后仍自动开浏览器', async () => {
    const port = await freePort()
    const setup = fixtureSetup(`sleep 0.6 && node ${serveFixture} ${port}`, port)
    const { manager, openExternal } = makeManager(setup.configPath, setup.base, { startTimeoutMs: 300 })
    await manager.init()
    await manager.start('fixture-web')
    await waitFor(() => stateOf(manager) === 'error', 3000)
    expect(openExternal).not.toHaveBeenCalled()

    await waitFor(() => stateOf(manager) === 'running', 8000)
    expect(openExternal).toHaveBeenCalledWith(setup.url)

    await manager.stop('fixture-web')
    await waitFor(() => stateOf(manager) === 'stopped', 5000)
  })

  it('start_timeout_ms 按成员取：manifest 值压过全局 opts', async () => {
    const port = await freePort()
    // manifest 声明 1.2s、全局给 6s：若读的是全局，3s 内根本不会出现「超时」
    const setup = fixtureSetup('sleep 30', port, 'start_timeout_ms = 1200\n')
    const { manager } = makeManager(setup.configPath, setup.base, { startTimeoutMs: 6000 })
    await manager.init()
    await manager.start('fixture-web')
    await waitFor(() => stateOf(manager) === 'error', 3000)
    const app = manager.list().apps.find((a) => a.name === 'fixture-web')
    expect(app?.line).toContain('1s')

    await manager.stop('fixture-web')
    await waitFor(() => stateOf(manager) === 'stopped', 5000)
  })
})
